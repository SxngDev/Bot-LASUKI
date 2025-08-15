// plugins/fantasmas.js
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

/** Obtiene el conteo para un participante, priorizando el JID real guardado en chatCount */
function getCountForParticipant(pRaw, pNormId, chatCount) {
  const candidates = new Set();

  // 1) Real si existe (normId ya convierte @lid->real cuando hay .jid)
  if (typeof pNormId === "string" && pNormId.endsWith("@s.whatsapp.net")) {
    candidates.add(pNormId);
  }

  // 2) El id "visible" por si en algún momento guardaste así (no debería, pero por si acaso)
  if (typeof pRaw?.id === "string") candidates.add(pRaw.id);

  // 3) Por dígitos -> @s.whatsapp.net (fallback robusto)
  const d = DIGITS(pNormId || pRaw?.id || "");
  if (d) candidates.add(`${d}@s.whatsapp.net`);

  // Recorre candidatos y devuelve el 1º que exista
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

  if (!isGroup) {
    await conn.sendMessage(chatId, { text: "❌ *Este comando solo se puede usar en grupos.*" }, { quoted: msg });
    return;
  }

  // Permisos: admin/owner/bot (compatible con LID)
  const isAdmin = await isAdminByNumber(conn, chatId, senderNum);

  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath)
    ? JSON.parse(fs.readFileSync(ownerPath, "utf-8"))
    : (global.owner || []);
  const isOwner = Array.isArray(owners) && owners.some(([id]) => id === senderNum);

  if (!isAdmin && !isOwner) {
    await conn.sendMessage(chatId, { text: "⛔ *Solo administradores o dueños del bot pueden usar este comando.*" }, { quoted: msg });
    return;
  }

  const limite = parseInt(args[0]);
  if (Number.isNaN(limite)) {
    await conn.sendMessage(chatId, {
      text: "❓ *Debes escribir un número de mensajes para detectar fantasmas.*\n\nEjemplo: `.fantasmas 10`"
    }, { quoted: msg });
    return;
  }

  // Cargar DB de conteos
  const filePath = path.resolve("setwelcome.json");
  const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : {};
  const chatData = data[chatId]?.chatCount || {};

  // Metadata y normalización LID->real
  const metadata = await conn.groupMetadata(chatId);
  const participantsRaw = Array.isArray(metadata?.participants) ? metadata.participants : [];
  const participantsNorm = lidParser(participantsRaw); // misma longitud, índice alineado

  // Construye lista de fantasmas: menciona con el *JID visible* (pRaw.id), cuenta con el *real*
  const fantasmasObjs = [];
  for (let i = 0; i < participantsRaw.length; i++) {
    const pRaw = participantsRaw[i];             // pRaw.id puede ser @lid
    const pNormId = participantsNorm[i]?.id;     // normalmente @s.whatsapp.net si hay .jid
    const count = getCountForParticipant(pRaw, pNormId, chatData);

    if (count < limite) {
      const visibleMentionJid = pRaw.id;         // lo que “se ve” en el grupo (mantiene @lid si aplica)
      fantasmasObjs.push({
        visibleMentionJid,
        placeholder: `@${(visibleMentionJid || "").split("@")[0]}`,
        count
      });
    }
  }

  const advertencia =
`⚠️ *Advertencia Importante*
Este conteo solo se basa en los mensajes detectados desde que *La Suki Bot* fue agregada al grupo.
No refleja actividad real de todo el historial del grupo. Podría mostrar como fantasmas a miembros valiosos que simplemente no han hablado aún.

Usa este comando con inteligencia 💡. Si planeas expulsar con *.fankick*, asegúrate de entender este límite.

`;

  if (fantasmasObjs.length === 0) {
    await conn.sendMessage(chatId, {
      text: `✅ *Todos los miembros han enviado más de ${limite} mensajes.*`
    }, { quoted: msg });
    return;
  }

  const listado =
    fantasmasObjs
      .map((u, i) => `│ ${i + 1}. ${u.placeholder}`)
      .join("\n");

  const texto =
`${advertencia}👻 *Total de fantasmas detectados:* ${fantasmasObjs.length} usuarios
📝 *Han enviado menos de ${limite} mensajes desde que el bot está en el grupo:*

╭───────────────◆
${listado}
╰───────────────◆

🗑️ Usa *.fankick ${limite}* para eliminar automáticamente a estos inactivos.`;

  await conn.sendMessage(
    chatId,
    {
      text: texto,
      // 👇 Mencionamos con el JID VISIBLE (si es LID, mantiene @lid)
      mentions: fantasmasObjs.map(f => f.visibleMentionJid)
    },
    { quoted: msg }
  );
};

handler.command = ["fantasmas"];
module.exports = handler;
