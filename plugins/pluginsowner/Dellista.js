const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const senderId = msg.key.participant || msg.key.remoteJid;
  const senderNum = senderId.replace(/[^0-9]/g, "");
  const fromMe = msg.key.fromMe;
  const botNumber = conn.user.id.split(":")[0]; // sin @s.whatsapp.net
  const isBot = fromMe || senderNum === botNumber;
  const isOwner = global.isOwner(senderId);

  if (!isBot && !isOwner) {
    return conn.sendMessage(chatId, {
      text: "⛔ Este comando solo lo puede usar el *bot* o su *dueño*."
    }, { quoted: msg });
  }

  let target = args[0]?.replace(/[^0-9]/g, "");
  const context = msg.message?.extendedTextMessage?.contextInfo;
  if (!target && context?.participant) {
    target = context.participant.replace(/[^0-9]/g, "");
  }

  if (!target) {
    return conn.sendMessage(chatId, {
      text: "⚠️ *Debes escribir el número o responder al mensaje del usuario a eliminar.*"
    }, { quoted: msg });
  }

  const jid = `${target}@s.whatsapp.net`;

  const filePath = path.resolve("setwelcome.json");
  const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : {};

  data.lista = data.lista || [];

  if (data.lista.includes(jid)) {
    data.lista = data.lista.filter(id => id !== jid);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    await conn.sendMessage(chatId, {
      text: `🗑️ Usuario @${target} ha sido *eliminado de la lista*.`,
      mentions: [jid]
    }, { quoted: msg });
  } else {
    await conn.sendMessage(chatId, {
      text: `⚠️ El usuario @${target} *no está en la lista*.`,
      mentions: [jid]
    }, { quoted: msg });
  }
};

handler.command = ["dellista"];
module.exports = handler;
