// plugins/restchat.js
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

/** ¿Es admin por NÚMERO? (funciona en LID y no-LID) */
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

const handler = async (msg, { conn }) => {
  const chatId   = msg.key.remoteJid;
  const isGroup  = chatId.endsWith("@g.us");
  const senderId = msg.key.participant || msg.key.remoteJid; // puede ser @lid
  const senderNo = DIGITS(senderId);
  const isFromMe = !!msg.key.fromMe;

  if (!isGroup) {
    await conn.sendMessage(chatId, { text: "❌ *Este comando solo puede usarse en grupos.*" }, { quoted: msg });
    return;
  }

  // Permisos: admin/owner/bot (LID-aware)
  const isAdmin = await isAdminByNumber(conn, chatId, senderNo);

  // Owners desde owner.json (o usa global.owner si ya lo cargas al inicio)
  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath)
    ? JSON.parse(fs.readFileSync(ownerPath, "utf-8"))
    : (global.owner || []);
  const isOwner = Array.isArray(owners) && owners.some(([id]) => id === senderNo);

  if (!isAdmin && !isOwner && !isFromMe) {
    await conn.sendMessage(chatId, {
      text: "⛔ *Solo administradores o dueños del bot pueden usar este comando.*"
    }, { quoted: msg });
    return;
  }

  const filePath = path.resolve("setwelcome.json");
  if (!fs.existsSync(filePath)) {
    await conn.sendMessage(chatId, {
      text: "❌ *No hay datos para este grupo.*"
    }, { quoted: msg });
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (data[chatId]?.chatCount) {
    delete data[chatId].chatCount;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    await conn.sendMessage(chatId, {
      text: "♻️ *El conteo de mensajes fue reiniciado en este grupo.*"
    }, { quoted: msg });
  } else {
    await conn.sendMessage(chatId, {
      text: "ℹ️ *Este grupo no tiene conteo de mensajes guardado.*"
    }, { quoted: msg });
  }
};

handler.command = ["restchat"];
module.exports = handler;
