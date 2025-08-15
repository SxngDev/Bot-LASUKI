const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

const handler = async (msg, { conn, text, usedPrefix, command }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || usedPrefix || '.';

  if (!text || (!text.includes('youtube.com') && !text.includes('youtu.be'))) {
    return conn.sendMessage(chatId, {
      text: `✳️ *Usa:*\n${pref}${command} <enlace de YouTube>\n📌 Ej: *${pref}${command}* https://youtube.com/watch?v=abc123`
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, {
    react: { text: '⏳', key: msg.key }
  });

  try {
    const qualities = ['720p', '480p', '360p'];
    let videoData = null;

    for (let quality of qualities) {
      try {
        const apiUrl = `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(text)}&type=video&quality=${quality}&apikey=russellxz`;
        const response = await axios.get(apiUrl);
        if (response.data?.status && response.data?.data?.url) {
          videoData = {
            url: response.data.data.url,
            title: response.data.title || 'video',
            thumbnail: response.data.thumbnail,
            duration: response.data.fduration,
            views: response.data.views,
            channel: response.data.channel,
            quality: response.data.data.quality || quality,
            size: response.data.data.size || 'Desconocido',
            publish: response.data.publish || 'Desconocido',
            id: response.data.id || ''
          };
          break;
        }
      } catch { continue; }
    }

    if (!videoData) throw new Error('❌ No se pudo obtener el video en ninguna calidad. Talvez excede el límite de 99MB.');

    const tmpDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const filePath = path.join(tmpDir, `${Date.now()}_video.mp4`);

    const response = await axios.get(videoData.url, {
      responseType: 'stream',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    await streamPipeline(response.data, fs.createWriteStream(filePath));

    const stats = fs.statSync(filePath);
    if (!stats || stats.size < 100000) {
      fs.unlinkSync(filePath);
      throw new Error('❌ El video descargado está vacío o incompleto.');
    }

    const caption = `🎬 *𝑽𝒊𝒅𝒆𝒐 𝒅𝒆 𝒀𝒐𝒖𝑻𝒖𝒃𝒆 𝒅𝒆𝒔𝒄𝒂𝒓𝒈𝒂𝒅𝒐*\n\n` +
      `𖠁 *Título:* ${videoData.title}\n` +
      `𖠁 *Duración:* ${videoData.duration}\n` +
      `𖠁 *Vistas:* ${videoData.views}\n` +
      `𖠁 *Canal:* ${videoData.channel}\n` +
      `𖠁 *Publicado:* ${videoData.publish}\n` +
      `𖠁 *Tamaño:* ${videoData.size}\n` +
      `𖠁 *Calidad:* ${videoData.quality}\n` +
      `𖠁 *Link:* https://youtu.be/${videoData.id}\n\n` +
      `𖠁 *¿No se reproduce?* Usa _${pref}ff_\n\n𖠁 *Procesado por La Suki Bot*`;

    await conn.sendMessage(chatId, {
      video: fs.readFileSync(filePath),
      mimetype: 'video/mp4',
      fileName: `${videoData.title}.mp4`,
      caption,
      gifPlayback: false
    }, { quoted: msg });

    fs.unlinkSync(filePath);

    await conn.sendMessage(chatId, {
      react: { text: '✅', key: msg.key }
    });

  } catch (err) {
    console.error("❌ Error en .ytmp4:", err.message);
    await conn.sendMessage(chatId, {
      text: `❌ *Error al procesar el video:*\n_${err.message}_`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: '❌', key: msg.key }
    });
  }
};

handler.command = ['ytmp4'];
handler.help = ['ytmp4 <enlace>'];
handler.tags = ['descargas'];
handler.register = true;

module.exports = handler;
