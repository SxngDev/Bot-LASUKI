const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  if (!chatId.endsWith("@g.us")) {
    await conn.sendMessage(chatId, {
      text: "❌ *Este comando solo funciona en grupos.*"
    }, { quoted: msg });
    return;
  }

  const filePath = path.resolve("setwelcome.json");
  if (!fs.existsSync(filePath)) {
    await conn.sendMessage(chatId, {
      text: "📊 *Aún no hay registros de mensajes en este grupo.*"
    }, { quoted: msg });
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const chatData = data[chatId];

  if (!chatData?.chatCount || Object.keys(chatData.chatCount).length === 0) {
    await conn.sendMessage(chatId, {
      text: "📊 *Este grupo aún no tiene mensajes registrados.*"
    }, { quoted: msg });
    return;
  }

  const ranking = Object.entries(chatData.chatCount)
    .sort(([, a], [, b]) => b - a)
    .map(([jid, count], i) => `${i + 1}. @${jid.split("@")[0]} — *${count}* mensajes`)
    .join("\n");

  await conn.sendMessage(chatId, {
    text: `📊 *Ranking de actividad en el grupo:*\n\n${ranking}`,
    mentions: Object.keys(chatData.chatCount)
  }, { quoted: msg });
};

handler.command = ["totalchat"];
module.exports = handler;
