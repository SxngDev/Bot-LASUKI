const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const isGroup = chatId.endsWith("@g.us");
  const senderId = msg.key.participant || msg.key.remoteJid;
  const senderNum = senderId.replace(/[^0-9]/g, "");
  const isBot = msg.key.fromMe;

  // Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "🧹", key: msg.key } });

  if (!isGroup) {
    return await conn.sendMessage(chatId, {
      text: "❌ Este comando solo se puede usar en grupos.",
      react: { text: "❌", key: msg.key }
    }, { quoted: msg });
  }

  // Obtener metadata del grupo
  let isAdmin = false;
  try {
    const meta = await conn.groupMetadata(chatId);
    const participant = meta.participants.find(p => p.id === senderId);
    isAdmin = participant?.admin === "admin" || participant?.admin === "superadmin";
  } catch {
    isAdmin = false;
  }

  if (!isAdmin && !isBot) {
    return await conn.sendMessage(chatId, {
      text: "🚫 Solo los administradores pueden usar este comando.",
      react: { text: "❌", key: msg.key }
    }, { quoted: msg });
  }

  const advPath = path.resolve("./advertencias.json");
  if (!fs.existsSync(advPath)) {
    return await conn.sendMessage(chatId, {
      text: "📁 No hay advertencias registradas aún.",
      react: { text: "ℹ️", key: msg.key }
    }, { quoted: msg });
  }

  const advertencias = JSON.parse(fs.readFileSync(advPath));
  if (advertencias[chatId]) {
    delete advertencias[chatId];
    fs.writeFileSync(advPath, JSON.stringify(advertencias, null, 2));
  }

  return await conn.sendMessage(chatId, {
    text: "✅ Todas las advertencias del grupo han sido eliminadas.",
    react: { text: "✅", key: msg.key }
  }, { quoted: msg });
};

handler.command = ["delwar"];
module.exports = handler;
