const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { promisify } = require('util');
const { pipeline } = require('stream');
const streamPipeline = promisify(pipeline);

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";

  const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quotedMsg || !quotedMsg.videoMessage) {
    return conn.sendMessage(chatId, {
      text: `✳️ *Uso incorrecto.*\n📌 Responde a un *video* con *${pref}ff* para optimizarlo para WhatsApp.`
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, {
    react: { text: '🔧', key: msg.key }
  });

  try {
    const tmpDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const rawPath = path.join(tmpDir, `${Date.now()}_raw.mp4`);
    const finalPath = path.join(tmpDir, `${Date.now()}_fixed.mp4`);

    const stream = await downloadContentFromMessage(quotedMsg.videoMessage, 'video');
    const writable = fs.createWriteStream(rawPath);
    for await (const chunk of stream) writable.write(chunk);
    writable.end();

    const startTime = Date.now();

    await new Promise((resolve, reject) => {
      ffmpeg(rawPath)
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 28',
          '-c:a aac',
          '-b:a 128k',
          '-movflags +faststart'
        ])
        .save(finalPath)
        .on('end', resolve)
        .on('error', reject);
    });

    const endTime = ((Date.now() - startTime) / 1000).toFixed(1);

    await conn.sendMessage(chatId, {
      video: fs.readFileSync(finalPath),
      mimetype: 'video/mp4',
      fileName: `video_optimo.mp4`,
      caption: `✅ *Video optimizado correctamente para WhatsApp*\n⏱️ *Conversión realizada en:* ${endTime}s\n\n🎬 *Procesado por La Suki Bot*`
    }, { quoted: msg });

    fs.unlinkSync(rawPath);
    fs.unlinkSync(finalPath);

    await conn.sendMessage(chatId, {
      react: { text: '✅', key: msg.key }
    });

  } catch (err) {
    console.error('❌ Error en .ff:', err.message);
    await conn.sendMessage(chatId, {
      text: `❌ *Ocurrió un error al procesar el video:*\n_${err.message}_`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: '❌', key: msg.key }
    });
  }
};

handler.command = ['ff'];
handler.help = ['ff'];
handler.tags = ['herramientas'];
handler.register = true;

module.exports = handler;
