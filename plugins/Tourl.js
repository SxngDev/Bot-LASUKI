const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const handler = async (msg, { conn, command }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (!quoted) {
    return conn.sendMessage(chatId, {
      text: `✳️ *Usa:*\n${pref}${command}\n📌 Responde a una imagen, video, sticker o audio para subirlo.`
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, {
    react: { text: '☁️', key: msg.key }
  });

  try {
    let typeDetected = null;
    let mediaMessage = null;

    if (quoted.imageMessage) {
      typeDetected = 'image';
      mediaMessage = quoted.imageMessage;
    } else if (quoted.videoMessage) {
      typeDetected = 'video';
      mediaMessage = quoted.videoMessage;
    } else if (quoted.stickerMessage) {
      typeDetected = 'sticker';
      mediaMessage = quoted.stickerMessage;
    } else if (quoted.audioMessage) {
      typeDetected = 'audio';
      mediaMessage = quoted.audioMessage;
    } else {
      throw new Error("❌ Solo se permiten imágenes, videos, stickers o audios.");
    }

    const tmpDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const rawExt = typeDetected === 'sticker' ? 'webp' :
      mediaMessage.mimetype ? mediaMessage.mimetype.split('/')[1].split(';')[0] : 'bin';

    const rawPath = path.join(tmpDir, `${Date.now()}_input.${rawExt}`);
    const stream = await downloadContentFromMessage(mediaMessage, typeDetected === 'sticker' ? 'sticker' : typeDetected);
    const writeStream = fs.createWriteStream(rawPath);
    for await (const chunk of stream) writeStream.write(chunk);
    writeStream.end();
    await new Promise(resolve => writeStream.on('finish', resolve));

    const stats = fs.statSync(rawPath);
    if (stats.size > 200 * 1024 * 1024) {
      fs.unlinkSync(rawPath);
      throw new Error('⚠️ El archivo excede el límite de 200MB.');
    }

    let finalPath = rawPath;

    if (typeDetected === 'audio' && ['ogg', 'm4a', 'mpeg'].includes(rawExt)) {
      finalPath = path.join(tmpDir, `${Date.now()}_converted.mp3`);
      await new Promise((resolve, reject) => {
        ffmpeg(rawPath)
          .audioCodec('libmp3lame')
          .toFormat('mp3')
          .on('end', resolve)
          .on('error', reject)
          .save(finalPath);
      });
      fs.unlinkSync(rawPath);
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(finalPath));

    const res = await axios.post('https://cdn.russellxz.click/upload.php', form, {
      headers: form.getHeaders(),
    });

    fs.unlinkSync(finalPath);

    if (!res.data || !res.data.url) throw new Error('❌ No se pudo subir el archivo.');

    await conn.sendMessage(chatId, {
      text: `✅ *Archivo subido exitosamente:*\n${res.data.url}`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: '✅', key: msg.key }
    });

  } catch (err) {
    console.error("❌ Error en .tourl:", err);
    await conn.sendMessage(chatId, {
      text: `❌ *Error:* ${err.message}`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: '❌', key: msg.key }
    });
  }
};

handler.command = ['tourl'];
handler.help = ['tourl'];
handler.tags = ['herramientas'];
handler.register = true;

module.exports = handler;
