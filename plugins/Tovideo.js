const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { spawn } = require('child_process');
const { promisify } = require('util');
const { pipeline } = require('stream');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const streamPipeline = promisify(pipeline);

const handler = async (msg, { conn, command }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
  if (!quoted) {
    await conn.sendMessage(chatId, {
      text: `⚠️ *Responde a un sticker para convertirlo a video.*\n\n📌 Ejemplo: *${pref}${command}*`,
    }, { quoted: msg });
    return;
  }

  await conn.sendMessage(chatId, {
    react: { text: '⏳', key: msg.key }
  });

  try {
    const tmp = path.join(__dirname, '../tmp');
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp);

    const input = path.join(tmp, `${Date.now()}.webp`);
    const output = path.join(tmp, `${Date.now()}_out.mp4`);
    const tempMp4 = path.join(tmp, `${Date.now()}_orig.mp4`);

    const stream = await downloadContentFromMessage(quoted, 'sticker');
    const writer = fs.createWriteStream(input);
    for await (const chunk of stream) writer.write(chunk);
    writer.end();

    const form = new FormData();
    form.append("file", fs.createReadStream(input));
    const upload = await axios.post("https://cdn.russellxz.click/upload.php", form, {
      headers: form.getHeaders()
    });

    if (!upload.data?.url) throw new Error("❌ No se pudo subir el sticker.");

    const convert = await axios.get(`https://api.neoxr.eu/api/webp2mp4?url=${encodeURIComponent(upload.data.url)}&apikey=russellxz`);
    const videoUrl = convert.data?.data?.url;
    if (!videoUrl) throw new Error("❌ No se pudo convertir el sticker a video.");

    const videoStream = await axios.get(videoUrl, { responseType: 'stream' });
    await streamPipeline(videoStream.data, fs.createWriteStream(tempMp4));

    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', ['-i', tempMp4, '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p', output]);
      ff.on('exit', code => code === 0 ? resolve() : reject(new Error("❌ Error al convertir con ffmpeg")));
    });

    await conn.sendMessage(chatId, {
      video: fs.readFileSync(output),
      mimetype: 'video/mp4',
      caption: '✅ *Sticker convertido a video.*\n\n© Azura Ultra 2.0'
    }, { quoted: msg });

    fs.unlinkSync(input);
    fs.unlinkSync(tempMp4);
    fs.unlinkSync(output);

    await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

  } catch (err) {
    console.error("❌ Error en tovideo:", err);
    await conn.sendMessage(chatId, {
      text: `❌ *Error:* ${err.message}`
    }, { quoted: msg });

    await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
  }
};

handler.command = ['tovideo'];
handler.help = ['tovideo'];
handler.tags = ['tools'];
handler.register = true;

module.exports = handler;
