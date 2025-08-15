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
  const audioMsg = quotedMsg?.audioMessage;
  const docMsg = quotedMsg?.documentMessage;
  const isAudioDoc = docMsg?.mimetype?.startsWith("audio");

  if (!audioMsg && !isAudioDoc) {
    return conn.sendMessage(chatId, {
      text: `✳️ *Uso incorrecto.*\n📌 Responde a un *audio* o *mp3 dañado* con *${pref}ff2* para repararlo.`
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, {
    react: { text: '🎧', key: msg.key }
  });

  try {
    const tmpDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const inputPath = path.join(tmpDir, `${Date.now()}_raw.mp3`);
    const outputPath = path.join(tmpDir, `${Date.now()}_fixed.mp3`);

    const stream = await downloadContentFromMessage(audioMsg ? audioMsg : docMsg, 'audio');
    const writable = fs.createWriteStream(inputPath);
    for await (const chunk of stream) writable.write(chunk);
    writable.end();

    const startTime = Date.now();

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .format('mp3')
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });

    const endTime = ((Date.now() - startTime) / 1000).toFixed(1);

    await conn.sendMessage(chatId, {
      audio: fs.readFileSync(outputPath),
      mimetype: 'audio/mpeg',
      fileName: `audio_reparado.mp3`,
      ptt: audioMsg?.ptt || false,
      caption: `✅ *Audio reparado exitosamente*\n⏱️ *Tiempo de reparación:* ${endTime}s\n\n🎧 *Procesado por La Suki Bot*`
    }, { quoted: msg });

    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    await conn.sendMessage(chatId, {
      react: { text: '✅', key: msg.key }
    });

  } catch (err) {
    console.error('❌ Error en .ff2:', err.message);
    await conn.sendMessage(chatId, {
      text: `❌ *Ocurrió un error al reparar el audio:*\n_${err.message}_`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: '❌', key: msg.key }
    });
  }
};

handler.command = ['ff2'];
handler.help = ['ff2'];
handler.tags = ['herramientas'];
handler.register = true;

module.exports = handler;
