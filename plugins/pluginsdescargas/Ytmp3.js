const axios = require('axios');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');

const handler = async (msg, { conn, text, args, usedPrefix, command }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || usedPrefix || '.';

  const isYoutubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(text);

  if (!text || !isYoutubeUrl) {
    return await conn.sendMessage(chatId, {
      text: `✳️ *Uso correcto:*\n${pref}${command} <enlace de YouTube>\n\n📌 *Ejemplo:*\n*${pref}${command}* https://youtu.be/dQw4w9WgXcQ`
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

  try {
    const apiURL = `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(text)}&type=audio&quality=128kbps&apikey=russellxz`;
    const res = await axios.get(apiURL);
    const json = res.data;

    if (!json.status || !json.data?.url) throw new Error("❌ No se pudo obtener el audio");

    const { data, title, fduration, thumbnail } = json;
    const sizeMB = parseFloat(data.size);

    if (sizeMB > 99) {
      return conn.sendMessage(chatId, {
        text: `🚫 *Archivo demasiado pesado:*\n📦 Tamaño: ${sizeMB.toFixed(2)}MB\n\n🔒 *Solo se permiten descargas menores a 99MB.*`
      }, { quoted: msg });
    }

    await conn.sendMessage(chatId, {
      image: { url: thumbnail },
      caption: `🎵 *Título:* ${title}\n⏱️ *Duración:* ${fduration}\n📦 *Tamaño:* ${sizeMB.toFixed(2)}MB\n\n✨ *Procesando audio...*`,
      mimetype: 'image/jpeg'
    }, { quoted: msg });

    const response = await axios.get(data.url, { responseType: 'stream' });
    const buffers = [];
    const passthrough = new PassThrough();

    ffmpeg(response.data)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .format('mp3')
      .on('error', async err => {
        console.error("❌ Error en ffmpeg:", err);
        await conn.sendMessage(chatId, {
          text: `❌ *Error al procesar el audio:* ${err.message}`
        }, { quoted: msg });
      })
      .on('end', async () => {
        const finalBuffer = Buffer.concat(buffers);

        await conn.sendMessage(chatId, {
          audio: finalBuffer,
          mimetype: 'audio/mpeg',
          fileName: `${title}.mp3`
        }, { quoted: msg });

        await conn.sendMessage(chatId, {
          react: { text: '✅', key: msg.key }
        });
      })
      .pipe(passthrough);

    passthrough.on('data', chunk => buffers.push(chunk));

  } catch (err) {
    console.error("❌ Error en .ytmp3:", err);
    await conn.sendMessage(chatId, {
      text: `❌ *Error inesperado:*\n_${err.message}_`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: '❌', key: msg.key }
    });
  }
};

handler.command = ['ytmp3'];
handler.help = ['ytmp3 <url>'];
handler.tags = ['descargas'];
handler.register = true;

module.exports = handler;
