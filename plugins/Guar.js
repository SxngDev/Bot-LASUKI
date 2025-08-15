const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const userId = sender.replace(/[^0-9]/g, "");

  // Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

  if (!msg.message.extendedTextMessage || 
      !msg.message.extendedTextMessage.contextInfo || 
      !msg.message.extendedTextMessage.contextInfo.quotedMessage) {
    return conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    }).then(() =>
      conn.sendMessage(chatId, {
        text: "❌ *Error:* Debes responder a un multimedia (imagen, video, audio, sticker, etc.) con una palabra clave para guardarlo.",
        quoted: msg
      })
    );
  }

  const saveKey = args.join(" ").trim().toLowerCase();
  if (!/[a-zA-Z0-9]/.test(saveKey)) {
    return conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    }).then(() =>
      conn.sendMessage(chatId, {
        text: "❌ *Error:* La palabra clave debe tener letras o números, no solo símbolos o emojis.",
        quoted: msg
      })
    );
  }

  const guarPath = path.resolve("./guar.json");
  if (!fs.existsSync(guarPath)) fs.writeFileSync(guarPath, JSON.stringify({}, null, 2));
  const guarData = JSON.parse(fs.readFileSync(guarPath, "utf-8"));

  const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
  let mediaType, mediaMessage, fileExtension;

  if (quotedMsg.imageMessage) {
    mediaType = "image";
    mediaMessage = quotedMsg.imageMessage;
    fileExtension = "jpg";
  } else if (quotedMsg.videoMessage) {
    mediaType = "video";
    mediaMessage = quotedMsg.videoMessage;
    fileExtension = "mp4";
  } else if (quotedMsg.audioMessage) {
    mediaType = "audio";
    mediaMessage = quotedMsg.audioMessage;
    fileExtension = "mp3";
  } else if (quotedMsg.stickerMessage) {
    mediaType = "sticker";
    mediaMessage = quotedMsg.stickerMessage;
    fileExtension = "webp";
  } else if (quotedMsg.documentMessage) {
    mediaType = "document";
    mediaMessage = quotedMsg.documentMessage;
    fileExtension = mediaMessage.mimetype.split("/")[1] || "bin";
  } else {
    return conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    }).then(() =>
      conn.sendMessage(chatId, {
        text: "❌ *Error:* Solo se aceptan imágenes, videos, audios, stickers y documentos.",
        quoted: msg
      })
    );
  }

  const mediaStream = await downloadContentFromMessage(mediaMessage, mediaType);
  let mediaBuffer = Buffer.alloc(0);
  for await (const chunk of mediaStream) {
    mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
  }

  const entry = {
    media: mediaBuffer.toString("base64"),
    mime: mediaMessage.mimetype,
    ext: fileExtension,
    user: userId
  };

  // Agregar al array de esa palabra clave
  guarData[saveKey] = guarData[saveKey] || [];
  guarData[saveKey].push(entry);

  fs.writeFileSync(guarPath, JSON.stringify(guarData, null, 2));
  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

  return conn.sendMessage(chatId, {
    text: `✅ *Guardado:* El archivo se añadió al paquete *"${saveKey}"*.`,
    quoted: msg
  });
};

handler.command = ["guar"];
module.exports = handler;
