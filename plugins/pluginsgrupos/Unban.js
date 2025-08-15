// plugins/unban.js
const fs = require("fs");
const path = require("path");

const DIGITS = (s = "") => String(s).replace(/\D/g, "");

/** Normaliza participantes: si id es @lid y trae .jid (real), usa el real */
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

/** ¿Es admin por NÚMERO? (funciona en LID y NO-LID) */
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

/** Dado un JID (real o @lid) → { realJid, number } */
async function resolveTarget(conn, chatId, anyJid) {
  const number = DIGITS(anyJid);
  let realJid = null;

  try {
    const meta = await conn.groupMetadata(chatId);
    const raw  = Array.isArray(meta?.participants) ? meta.participants : [];
    const norm = lidParser(raw);

    if (typeof anyJid === "string" && anyJid.endsWith("@s.whatsapp.net")) {
      realJid = anyJid;
    } else if (typeof anyJid === "string" && anyJid.endsWith("@lid")) {
      const idx = raw.findIndex(p => p?.id === anyJid);
      if (idx >= 0) {
        const r = raw[idx];
        if (typeof r?.jid === "string" && r.jid.endsWith("@s.whatsapp.net")) realJid = r.jid;
        else if (typeof norm[idx]?.id === "string" && norm[idx].id.endsWith("@s.whatsapp.net")) realJid = norm[idx].id;
      }
    }
    if (!realJid && number) realJid = `${number}@s.whatsapp.net`;
  } catch {
    if (number) realJid = `${number}@s.whatsapp.net`;
  }

  return { realJid, number };
}

const handler = async (msg, { conn }) => {
  const chatId   = msg.key.remoteJid;
  const isGroup  = chatId.endsWith("@g.us");
  const senderId = msg.key.participant || msg.key.remoteJid;
  const senderNo = DIGITS(senderId);
  const fromMe   = !!msg.key.fromMe;
  const isOwner  = Array.isArray(global.owner) && global.owner.some(([id]) => id === senderNo);

  if (!isGroup) {
    return conn.sendMessage(chatId, { text: "❌ Este comando solo puede usarse en grupos." }, { quoted: msg });
  }

  const isAdmin = await isAdminByNumber(conn, chatId, senderNo);
  if (!isAdmin && !isOwner && !fromMe) {
    return conn.sendMessage(chatId, { text: "❌ Solo *admins* o *dueños* del bot pueden usar este comando." }, { quoted: msg });
  }

  // Objetivo por respuesta o mención
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const mentioned = Array.isArray(ctx?.mentionedJid) ? ctx.mentionedJid : [];
  const replyJid  = ctx?.participant;

  let targetJid = null;
  if (replyJid) targetJid = replyJid;
  else if (mentioned.length) targetJid = mentioned[0];

  if (!targetJid) {
    return conn.sendMessage(chatId, { text: "⚠️ Responde a un mensaje o menciona al usuario que quieres desbanear." }, { quoted: msg });
  }

  // Resolver real/número
  const { realJid, number } = await resolveTarget(conn, chatId, targetJid);
  const mentionId = realJid || `${number}@s.whatsapp.net`;

  // Cargar y limpiar setwelcome.json (remueve cualquier variante del mismo número)
  const welcomePath = path.resolve("setwelcome.json");
  const data = fs.existsSync(welcomePath) ? JSON.parse(fs.readFileSync(welcomePath, "utf-8")) : {};
  data[chatId] = data[chatId] || {};
  const list = Array.isArray(data[chatId].banned) ? data[chatId].banned : [];

  const before = list.length;
  const filtered = list.filter(entry => DIGITS(entry) !== number);

  data[chatId].banned = filtered;
  fs.writeFileSync(welcomePath, JSON.stringify(data, null, 2));

  if (filtered.length < before) {
    await conn.sendMessage(chatId, {
      text: `✅ Usuario @${number} fue *desbaneado*.`,
      mentions: [mentionId]
    }, { quoted: msg });
  } else {
    await conn.sendMessage(chatId, {
      text: "⚠️ Este usuario no estaba baneado.",
      mentions: [mentionId]
    }, { quoted: msg });
  }
};

handler.command = ["unban"];
module.exports = handler;
