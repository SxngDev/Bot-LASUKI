// plugins/fankick.js
const fs = require("fs");
const path = require("path");

const DIGITS = (s = "") => String(s).replace(/\D/g, "");

/** Normaliza: si un participante viene como @lid y tiene .jid (real), usa ese real */
function lidParser(participants = []) {
  try {
    return participants.map(v => ({
      id: (typeof v?.id === "string" && v.id.endsWith("@lid") && v.jid)
        ? v.jid
        : v.id,
      admin: v?.admin ?? null,
      raw: v
    }));
  } catch {
    return participants || [];
  }
}

/** ¿Es admin por NÚMERO? (sirve en LID y no-LID) */
async function isAdminByNumber(conn, chatId, number) {
  try {
    const meta = await conn.groupMetadata(chatId);
    const raw  = Array.isArray(meta?.participants) ? meta.participants : [];
    const norm = lidParser(raw);

    for (let i = 0; i < raw.length; i++) {
      const r = raw[i], n = norm[i];
      const isAdm = (r?.admin === "admin" || r?.admin === "superadmin" ||
                     n?.admin === "admin" || n?.admin === "superadmin");
      if (!isAdm) continue;
      const ids = [r?.id, r?.jid, n?.id];
      if (ids.some(x => DIGITS(x || "") === number)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Devuelve el conteo asociado a un participante, priorizando el JID real guardado en chatCount */
function getCountForParticipant(pRaw, normId, chatCount) {
  const candidates = new Set();

  // Real si existe
  if (typeof normId === "string" && normId.endsWith("@s.whatsapp.net")) {
    candidates.add(normId);
  }
  // visible por si acaso (no debería, pero contemplamos)
  if (typeof pRaw?.id === "string") candidates.add(pRaw.id);

  // Fallback por dígitos -> real
  const d = DIGITS(normId || pRaw?.id || "");
  if (d) candidates.add(`${d}@s.whatsapp.net`);

  for (const key of candidates) {
    const val = parseInt(chatCount[key]);
    if (!Number.isNaN(val)) return val;
  }
  return 0;
}

const handler = async (msg, { conn, args }) => {
  const chatId    = msg.key.remoteJid;
  const isGroup   = chatId.endsWith("@g.us");
  const senderId  = msg.key.participant || msg.key.remoteJid; // puede ser @lid
  const senderNum = DIGITS(senderId);
  const fromMe    = !!msg.key.fromMe;

  if (!isGroup) {
    await conn.sendMessage(chatId, { text: "❌ *Este comando solo se puede usar en grupos.*" }, { quoted: msg });
    return;
  }

  // Permisos: admin/owner/bot (compatibles con LID)
  const isAdmin = await isAdminByNumber(conn, chatId, senderNum);

  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath)
    ? JSON.parse(fs.readFileSync(ownerPath, "utf-8"))
    : (global.owner || []);
  const isOwner = Array.isArray(owners) && owners.some(([id]) => id === senderNum);

  if (!isAdmin && !isOwner && !fromMe) {
    await conn.sendMessage(chatId, { text: "⛔ *Solo administradores o dueños del bot pueden usar este comando.*" }, { quoted: msg });
    return;
  }

  const limite = parseInt(args[0]);
  if (Number.isNaN(limite)) {
    await conn.sendMessage(chatId, {
      text:
"🎛️ *Debes escribir un número de mensajes como límite.*\n\n" +
"Ejemplo: `.fankick 10`\n\n" +
"⚠️ *Advertencia importante:* Este sistema elimina automáticamente a todos los usuarios que hayan enviado *menos de N* mensajes (desde que el bot está en el grupo). " +
"Úsalo con responsabilidad; podría expulsar miembros valiosos que aún no hablaron. 👻"
    }, { quoted: msg });
    return;
  }

  // Cargar DB de conteos (normalmente guardados con JID real)
  const filePath = path.resolve("setwelcome.json");
  const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : {};
  const chatData = data[chatId]?.chatCount || {};

  // Metadata
  const metadata = await conn.groupMetadata(chatId);
  const participantsRaw  = Array.isArray(metadata?.participants) ? metadata.participants : [];
  const participantsNorm = lidParser(participantsRaw); // índices alineados

  const ownersNums = new Set((owners || []).map(([id]) => String(id)));
  const botNumber  = DIGITS(conn.user?.id?.split?.(":")?.[0] || "");
  const eliminadosPlaceholders = [];
  const mentionJidsVisible     = []; // para @menciones (usa visible; mantiene @lid)
  const toKickJids             = []; // lista efectiva a expulsar (reales preferidos)

  for (let i = 0; i < participantsRaw.length; i++) {
    const pRaw        = participantsRaw[i];
    const visibleJid  = pRaw?.id || "";                // puede ser @lid
    const normId      = participantsNorm[i]?.id || ""; // normalmente @s.whatsapp.net si hay .jid
    const realDigits  = DIGITS(normId || visibleJid);
    const isBot       = realDigits === botNumber;

    // Admin/owner/bot -> nunca expulsar
    const isParticipantAdmin =
      pRaw?.admin === "admin" || pRaw?.admin === "superadmin" ||
      participantsNorm[i]?.admin === "admin" || participantsNorm[i]?.admin === "superadmin";
    const isParticipantOwner = ownersNums.has(realDigits);

    if (isParticipantAdmin || isParticipantOwner || isBot) continue;

    // Conteo (prioriza real pero soporta visible/dígitos)
    const count = getCountForParticipant(pRaw, normId, chatData);
    if (count >= limite) continue;

    // Candidato válido: prepara expulsión
    const kickReal = (typeof normId === "string" && normId.endsWith("@s.whatsapp.net")) ? normId : null;
    const kickTry  = kickReal || visibleJid; // primero real; si no, el visible
    toKickJids.push({ try: kickTry, alt: kickReal ? visibleJid : null });

    eliminadosPlaceholders.push(`@${realDigits}`);
    mentionJidsVisible.push(visibleJid); // menciona con lo visible (respeta @lid)
  }

  // Ejecutar expulsiones con backoff leve
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const kicked = [];

  for (const item of toKickJids) {
    try {
      await conn.groupParticipantsUpdate(chatId, [item.try], "remove");
      kicked.push(item.try);
      await sleep(1800);
    } catch (e1) {
      // Reintento con alternativa si existe (por si el grupo exige el otro JID)
      if (item.alt) {
        try {
          await conn.groupParticipantsUpdate(chatId, [item.alt], "remove");
          kicked.push(item.alt);
          await sleep(1800);
        } catch (e2) {
          console.error("[fankick] No se pudo eliminar:", item.try, "-> alt:", item.alt, e2);
        }
      } else {
        console.error("[fankick] No se pudo eliminar:", item.try, e1);
      }
    }
  }

  if (kicked.length === 0) {
    await conn.sendMessage(chatId, {
      text: `🎉 *No se eliminó a nadie.* Todos tienen ≥ ${limite} mensajes o son admins/owners/bot.`
    }, { quoted: msg });
    return;
  }

  await conn.sendMessage(
    chatId,
    {
      text:
`🧹 *Usuarios eliminados por inactividad (< ${limite} mensajes):*\n\n` +
eliminadosPlaceholders.map((u, i) => `${i + 1}. ${u}`).join("\n"),
      // Menciona usando el JID VISIBLE (si es LID, mantiene @lid)
      mentions: mentionJidsVisible
    },
    { quoted: msg }
  );
};

handler.command = ["fankick"];
module.exports = handler;
