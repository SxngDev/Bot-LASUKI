// plugins/mute.js
const fs = require("fs");
const path = require("path");

const DIGITS = (s = "") => String(s).replace(/\D/g, "");

/** Normaliza: si un participante viene como @lid y tiene .jid (real), usa el real */
function lidParser(participants = []) {
  try {
    return participants.map(v => ({
      id: (typeof v?.id === "string" && v.id.endsWith("@lid") && v.jid) ? v.jid : v.id,
      admin: v?.admin ?? null,
      raw: v
    }));
  } catch {
    return participants || [];
  }
}

/** Verifica admin por NÚMERO (sirve en grupos LID y no-LID) */
async function isAdminByNumber(conn, chatId, number) {
  try {
    const meta = await conn.groupMetadata(chatId);
    const raw  = Array.isArray(meta?.participants) ? meta.participants : [];
    const norm = lidParser(raw);

    const adminNums = new Set();
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i], n = norm[i];
      const flag = (r?.admin === "admin" || r?.admin === "superadmin" ||
                    n?.admin === "admin" || n?.admin === "superadmin");
      if (flag) {
        [r?.id, r?.jid, n?.id].forEach(x => {
          const d = DIGITS(x || "");
          if (d) adminNums.add(d);
        });
      }
    }
    return adminNums.has(number);
  } catch {
    return false;
  }
}

/** Dado un JID (real o @lid), resuelve { realJid, lidJid, number } */
async function resolveTarget(conn, chatId, anyJid) {
  const number = DIGITS(anyJid);
  let realJid = null, lidJid = null;

  try {
    const meta = await conn.groupMetadata(chatId);
    const raw  = Array.isArray(meta?.participants) ? meta.participants : [];
    const norm = lidParser(raw);

    // Si ya viene real
    if (typeof anyJid === "string" && anyJid.endsWith("@s.whatsapp.net")) {
      realJid = anyJid;
      // buscar su lid "pareja" en la lista cruda
      for (let i = 0; i < raw.length; i++) {
        const n = norm[i]?.id || "";
        if (n === realJid && typeof raw[i]?.id === "string" && raw[i].id.endsWith("@lid")) {
          lidJid = raw[i].id;
          break;
        }
      }
    } else if (typeof anyJid === "string" && anyJid.endsWith("@lid")) {
      // Buscar por índice exacto
      const idx = raw.findIndex(p => p?.id === anyJid);
      if (idx >= 0) {
        const r = raw[idx];
        if (typeof r?.jid === "string" && r.jid.endsWith("@s.whatsapp.net")) realJid = r.jid;
        else if (typeof norm[idx]?.id === "string" && norm[idx].id.endsWith("@s.whatsapp.net")) realJid = norm[idx].id;
      }
      lidJid = anyJid;
    }

    // Fallback por número si falta realJid
    if (!realJid && number) realJid = `${number}@s.whatsapp.net`;
  } catch {
    if (number) realJid = `${number}@s.whatsapp.net`;
  }

  return { realJid, lidJid, number };
}

const handler = async (msg, { conn }) => {
  const chatId   = msg.key.remoteJid;
  const isGroup  = chatId.endsWith("@g.us");
  const senderId = msg.key.participant || msg.key.remoteJid;
  const senderNo = DIGITS(senderId);
  const fromMe   = !!msg.key.fromMe;

  if (!isGroup) {
    return conn.sendMessage(chatId, { text: "❌ *Este comando solo puede usarse en grupos.*" }, { quoted: msg });
  }

  // Permisos (admin por número, owner, o el propio bot)
  const isAdmin = await isAdminByNumber(conn, chatId, senderNo);
  const isOwner = (typeof global.isOwner === "function") ? global.isOwner(senderId) : false;

  if (!isAdmin && !isOwner && !fromMe) {
    return conn.sendMessage(chatId, {
      text: "⛔ *Solo administradores o dueños del bot pueden usar este comando.*"
    }, { quoted: msg });
  }

  // Objetivos: respuesta o menciones
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const mentionedJids = Array.isArray(ctx?.mentionedJid) ? ctx.mentionedJid : [];
  const replyJid = ctx?.participant;

  const rawTargets = new Set();
  if (replyJid) rawTargets.add(replyJid);
  mentionedJids.forEach(j => rawTargets.add(j));

  if (!rawTargets.size) {
    return conn.sendMessage(chatId, {
      text: "⚠️ *Responde o menciona a uno o más usuarios para mutear.*"
    }, { quoted: msg });
  }

  // Cargar DB
  const welcomePath = path.resolve("setwelcome.json");
  const welcomeData = fs.existsSync(welcomePath)
    ? JSON.parse(fs.readFileSync(welcomePath, "utf-8"))
    : {};
  welcomeData[chatId] = welcomeData[chatId] || {};
  welcomeData[chatId].muted = Array.isArray(welcomeData[chatId].muted) ? welcomeData[chatId].muted : [];

  const mutedList = new Set(welcomeData[chatId].muted);
  const nuevosLines = [];
  const yaLines     = [];
  const mentionSet  = new Set(); // menciones reales

  for (const anyJid of rawTargets) {
    const { realJid, lidJid, number } = await resolveTarget(conn, chatId, anyJid);

    // No mutear owners
    if ((typeof global.isOwner === "function") && global.isOwner(realJid || anyJid)) continue;

    // Guardamos las 3 formas para robustez: realJid, lidJid y solo número
    const forms = new Set([realJid, lidJid, number].filter(Boolean));

    // ¿Alguna de las formas ya está en la lista?
    const yaEsta = [...forms].some(f => mutedList.has(f));

    if (yaEsta) {
      yaLines.push(`@${number}`);
    } else {
      forms.forEach(f => mutedList.add(f));
      nuevosLines.push(`@${number}`);
    }

    if (realJid) mentionSet.add(realJid);
    else if (number) mentionSet.add(`${number}@s.whatsapp.net`);
  }

  // Persistir
  welcomeData[chatId].muted = [...mutedList];
  fs.writeFileSync(welcomePath, JSON.stringify(welcomeData, null, 2));

  // Respuesta
  let texto = "";
  if (nuevosLines.length) {
    texto += `🔇 *Usuarios muteados correctamente:*\n${nuevosLines.map((u, i) => `${i + 1}. ${u}`).join("\n")}\n\n`;
  }
  if (yaLines.length) {
    texto += `⚠️ *Ya estaban muteados:*\n${yaLines.map((u, i) => `${i + 1}. ${u}`).join("\n")}`;
  }
  if (!texto) texto = "ℹ️ *No se realizaron cambios.*";

  await conn.sendMessage(chatId, {
    text: texto.trim(),
    mentions: [...mentionSet]
  }, { quoted: msg });
};

handler.command = ["mute"];
module.exports = handler;
