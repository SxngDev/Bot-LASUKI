const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderClean = sender.replace(/[^0-9]/g, "");
  const isFromMe = msg.key.fromMe;
  const isOwner = global.owner.some(([id]) => id === senderClean);

  if (!isOwner && !isFromMe) {
    return conn.sendMessage(chatId, {
      text: "❌ Solo el *owner* o el *bot mismo* puede restringir comandos.",
    }, { quoted: msg });
  }

  if (!args[0]) {
    return conn.sendMessage(chatId, {
      text: "⚠️ Usa: *re [comando]* para restringirlo en este grupo.",
    }, { quoted: msg });
  }

  const comando = args[0].toLowerCase();
  const welcomePath = path.resolve("setwelcome.json");

  const data = fs.existsSync(welcomePath)
    ? JSON.parse(fs.readFileSync(welcomePath, "utf-8"))
    : {};

  data[chatId] = data[chatId] || {};
  data[chatId].restringidos = data[chatId].restringidos || [];

  if (data[chatId].restringidos.includes(comando)) {
    return conn.sendMessage(chatId, {
      text: `⚠️ El comando *${comando}* ya está restringido en este grupo.`,
    }, { quoted: msg });
  }

  data[chatId].restringidos.push(comando);
  fs.writeFileSync(welcomePath, JSON.stringify(data, null, 2));

  await conn.sendMessage(chatId, {
    react: { text: "🔒", key: msg.key }
  });

  return conn.sendMessage(chatId, {
    text: `✅ El comando *${comando}* ha sido *restringido* en este grupo.`,
  }, { quoted: msg });
};

handler.command = ["re"];
module.exports = handler;
