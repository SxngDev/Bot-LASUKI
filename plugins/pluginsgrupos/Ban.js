// plugins/ban.js
const fs = require("fs");
const path = require("path");

const DIGITS = (s = "") => String(s).replace(/\D/g, "");

/** Normaliza: si un participante viene como @lid y trae .jid (real), usa el real */
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

/** Verifica si un NÚMERO es admin del chat (sirve en grupos LID y NO-LID) */
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

/** Dado un JID (real o @lid), resuelve { realJid, number } */
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
  const isOwner  = (typeof global.isOwner === "function") ? global.isOwner(senderId) : false;

  if (!isGroup) {
    return conn.sendMessage(chatId, { text: "❌ *Este comando solo puede usarse en grupos.*" }, { quoted: msg });
  }

  const isAdmin = await isAdminByNumber(conn, chatId, senderNo);
  if (!isAdmin && !isOwner && !fromMe) {
    return conn.sendMessage(chatId, { text: "❌ Solo *admins* o *dueños* del bot pueden usar este comando." }, { quoted: msg });
  }

  // Objetivo: respuesta o menciones
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const mentioned = Array.isArray(ctx?.mentionedJid) ? ctx.mentionedJid : [];
  const replyJid  = ctx?.participant;

  let targetJid = null;
  if (replyJid) targetJid = replyJid;
  else if (mentioned.length) targetJid = mentioned[0];

  if (!targetJid) {
    return conn.sendMessage(chatId, { text: "⚠️ *Responde a un mensaje o menciona al usuario que quieres banear.*" }, { quoted: msg });
  }

  // Resolver objetivo (REAL)
  const { realJid, number } = await resolveTarget(conn, chatId, targetJid);

  // No permitir banear owner/admin/bot
  const isTargetOwner = Array.isArray(global.owner) && global.owner.some(([id]) => id === number);
  const isTargetAdmin = await isAdminByNumber(conn, chatId, number);
  const botNumber     = DIGITS(conn.user?.id || "");
  const isTargetBot   = number === botNumber;

  if (isTargetOwner) return conn.sendMessage(chatId, { text: "❌ *No puedes banear al dueño del bot.*" }, { quoted: msg });
  if (isTargetAdmin) return conn.sendMessage(chatId, { text: "⚠️ *No puedes banear a un administrador del grupo.*" }, { quoted: msg });
  if (isTargetBot)   return conn.sendMessage(chatId, { text: "🤖 *No tiene sentido banear al bot.*" }, { quoted: msg });

  // Cargar y ACTUALIZAR setwelcome.json guardando SOLO el número real (y su JID real)
  const welcomePath = path.resolve("setwelcome.json");
  const data = fs.existsSync(welcomePath) ? JSON.parse(fs.readFileSync(welcomePath, "utf-8")) : {};
  data[chatId] = data[chatId] || {};

  // Normaliza la lista: elimina variantes del mismo usuario (incluyendo posibles @lid antiguos)
  const bannedSet = new Set(Array.isArray(data[chatId].banned) ? data[chatId].banned : []);
  for (const v of [...bannedSet]) if (DIGITS(v) === number) bannedSet.delete(v);

  // Guarda SOLO formas reales/estables
  bannedSet.add(number);                         // número limpio
  bannedSet.add(realJid || `${number}@s.whatsapp.net`); // JID real

  data[chatId].banned = [...bannedSet];
  fs.writeFileSync(welcomePath, JSON.stringify(data, null, 2));

  // Respuesta (menciona con JID real)
  await conn.sendMessage(chatId, {
    text: `🚫 Usuario @${number} ha sido *baneado*.`,
    mentions: [realJid || `${number}@s.whatsapp.net`]
  }, { quoted: msg });
};

handler.command = ["ban"];
module.exports = handler;
