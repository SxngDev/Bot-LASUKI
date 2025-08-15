const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const senderId = (msg.key.participant || msg.key.remoteJid).replace(/[^0-9]/g, "");
  const isFromMe = msg.key.fromMe;

  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath) ? JSON.parse(fs.readFileSync(ownerPath)) : [];
  const isOwner = owners.some(([id]) => id === senderId);

  if (!isOwner && !isFromMe) {
    await conn.sendMessage(chatId, {
      text: "⚠️ Solo el *Owner* puede usar este comando."
    }, { quoted: msg });
    return;
  }

  await conn.sendMessage(chatId, { react: { text: "🚀", key: msg.key } });

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) {
    await conn.sendMessage(chatId, {
      text: "⚠️ Debes *citar* el mensaje que deseas enviar con el comando .bc"
    }, { quoted: msg });
    return;
  }

  const fecha = new Date().toLocaleString("es-ES", { timeZone: "America/Argentina/Buenos_Aires" });
  const header = `📢 *COMUNICADO OFICIAL DE SUKI BOT* 📢\n──────────────\n🕒 Fecha: ${fecha}\n──────────────\n\n`;

  let broadcastMsg = {};

  if (quoted.conversation) {
    broadcastMsg = { text: header + quoted.conversation };
  } else if (quoted.extendedTextMessage?.text) {
    broadcastMsg = { text: header + quoted.extendedTextMessage.text };
  } else if (quoted.imageMessage) {
    const stream = await downloadContentFromMessage(quoted.imageMessage, "image");
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    broadcastMsg = {
      image: buffer,
      caption: header + (quoted.imageMessage.caption || "")
    };
  } else if (quoted.videoMessage) {
    const stream = await downloadContentFromMessage(quoted.videoMessage, "video");
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    broadcastMsg = {
      video: buffer,
      caption: header + (quoted.videoMessage.caption || ""),
      gifPlayback: quoted.videoMessage.gifPlayback || false
    };
  } else if (quoted.audioMessage) {
    const stream = await downloadContentFromMessage(quoted.audioMessage, "audio");
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    await conn.sendMessage(chatId, { text: header });
    broadcastMsg = { audio: buffer, mimetype: "audio/mpeg" };
  } else if (quoted.stickerMessage) {
    const stream = await downloadContentFromMessage(quoted.stickerMessage, "sticker");
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    await conn.sendMessage(chatId, { text: header });
    broadcastMsg = { sticker: buffer };
  } else {
    await conn.sendMessage(chatId, {
      text: "❌ No se reconoce el tipo de mensaje citado."
    }, { quoted: msg });
    return;
  }

  let groups;
  try {
    groups = await conn.groupFetchAllParticipating();
  } catch (err) {
    console.error("❌ Error al obtener grupos:", err);
    await conn.sendMessage(chatId, { text: "❌ No pude obtener los grupos." });
    return;
  }

  const groupIds = Object.keys(groups);
  for (const groupId of groupIds) {
    try {
      await conn.sendMessage(groupId, broadcastMsg);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
    } catch (err) {
      console.error(`❌ Error al enviar a ${groupId}:`, err);
    }
  }

  await conn.sendMessage(chatId, {
    text: `✅ *Broadcast enviado a ${groupIds.length} grupos correctamente.*`
  }, { quoted: msg });
};

handler.command = ["bc"];
module.exports = handler;
