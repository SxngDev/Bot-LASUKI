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
      text: "❌ Solo el *owner* o el *bot mismo* puede quitar restricciones.",
    }, { quoted: msg });
  }

  if (!args[0]) {
    return conn.sendMessage(chatId, {
      text: "⚠️ Usa: *unre [comando]* para quitar la restricción.",
    }, { quoted: msg });
  }

  const comando = args[0].toLowerCase();
  const welcomePath = path.resolve("setwelcome.json");

  const data = fs.existsSync(welcomePath)
    ? JSON.parse(fs.readFileSync(welcomePath, "utf-8"))
    : {};

  data[chatId] = data[chatId] || {};
  data[chatId].restringidos = data[chatId].restringidos || [];

  if (!data[chatId].restringidos.includes(comando)) {
    return conn.sendMessage(chatId, {
      text: `⚠️ El comando *${comando}* no estaba restringido.`,
    }, { quoted: msg });
  }

  data[chatId].restringidos = data[chatId].restringidos.filter(cmd => cmd !== comando);
  fs.writeFileSync(welcomePath, JSON.stringify(data, null, 2));

  await conn.sendMessage(chatId, {
    react: { text: "🔓", key: msg.key }
  });

  return conn.sendMessage(chatId, {
    text: `✅ El comando *${comando}* ha sido *liberado* en este grupo.`,
  }, { quoted: msg });
};

handler.command = ["unre"];
module.exports = handler;
