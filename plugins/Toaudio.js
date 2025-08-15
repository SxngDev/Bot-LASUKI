const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require("fs");
const path = require("path");
const { toAudio } = requireFromRoot("libs/converter.js");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const prefixPath = path.resolve("prefixes.json");
  let pref = ".";

  if (fs.existsSync(prefixPath)) {
    try {
      const prefixData = JSON.parse(fs.readFileSync(prefixPath, "utf-8"));
      pref = prefixData[chatId] || ".";
    } catch {}
  }

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) {
    return await conn.sendMessage(chatId, {
      text: `⚠️ *Responde a un video o audio para convertirlo a MP3.*\n\n✳️ *Ejemplo:*\n➤ ${pref}toaudio`,
    }, { quoted: msg });
  }

  const mediaType = quoted.videoMessage ? "video" : quoted.audioMessage ? "audio" : null;
  if (!mediaType) {
    return await conn.sendMessage(chatId, {
      text: '⚠️ *Solo puedes convertir videos o audios a MP3.*'
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, {
    react: { text: "🛠️", key: msg.key }
  });

  try {
    const stream = await downloadContentFromMessage(quoted[`${mediaType}Message`], mediaType);
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    if (!buffer.length) throw new Error("❌ No se pudo descargar el archivo.");

    const audio = await toAudio(buffer, 'mp4');

    await conn.sendMessage(chatId, {
      audio,
      mimetype: 'audio/mpeg'
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (err) {
    console.error("❌ Error en el comando toaudio:", err);
    await conn.sendMessage(chatId, {
      text: "❌ *Hubo un error al convertir a MP3. Intenta nuevamente.*"
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ["toaudio", "tomp3"];
handler.help = ["toaudio"];
handler.tags = ["conversores"];
handler.register = true;

module.exports = handler;
