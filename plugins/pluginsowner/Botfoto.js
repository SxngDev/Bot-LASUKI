const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const senderId = (msg.key.participant || msg.key.remoteJid).replace(/[^0-9]/g, "");
  const isFromMe = msg.key.fromMe;

  // Verificar owner desde owner.json
  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath) ? JSON.parse(fs.readFileSync(ownerPath)) : [];
  const isOwner = owners.some(([id]) => id === senderId);

  if (!isOwner && !isFromMe) {
    await conn.sendMessage(chatId, {
      text: "⛔ *Solo los dueños del bot pueden cambiar la foto de perfil.*"
    }, { quoted: msg });
    return;
  }

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const key = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
  const participant = msg.message?.extendedTextMessage?.contextInfo?.participant;

  if (!quoted || !quoted.imageMessage) {
    await conn.sendMessage(chatId, {
      text: "⚠️ *Debes responder a una imagen para cambiar la foto del bot.*"
    }, { quoted: msg });
    return;
  }

  try {

    let result = await downloadContentFromMessage(quoted.imageMessage, "image")
    let buffer = Buffer.from([]);
    
    for await (const chunk of result) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    await conn.updateProfilePicture(conn.user.id.replace(/:\d+/, ''), buffer);

    await conn.sendMessage(chatId, {
      text: "✅ *La foto de perfil del bot fue actualizada correctamente.*"
    }, { quoted: msg });
  } catch (err) {
    console.error("❌ Error al cambiar foto:", err);
    await conn.sendMessage(chatId, {
      text: "❌ *Ocurrió un error al cambiar la foto.*"
    }, { quoted: msg });
  }
};

handler.command = ["botfoto"];
module.exports = handler;
