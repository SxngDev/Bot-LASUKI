const yts = require('yt-search');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const ffmpeg = require('fluent-ffmpeg');
const streamPipeline = promisify(pipeline);

const formatAudio = ['mp3', 'm4a', 'webm', 'acc', 'flac', 'opus', 'ogg', 'wav'];

const ddownr = {
  download: async (url, format) => {
    if (!formatAudio.includes(format)) throw new Error('Formato no soportado.');
    const res = await axios.get(`https://p.oceansaver.in/ajax/download.php?format=${format}&url=${encodeURIComponent(url)}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`);
    if (!res.data || !res.data.success) throw new Error('No se pudo obtener la info del video.');
    const { id, title, info } = res.data;
    const downloadUrl = await ddownr.cekProgress(id);
    return { title, downloadUrl, thumbnail: info.image };
  },
  cekProgress: async (id) => {
    while (true) {
      const res = await axios.get(`https://p.oceansaver.in/ajax/progress.php?id=${id}`);
      if (res.data?.success && res.data.progress === 1000) {
        return res.data.download_url;
      }
      await new Promise(r => setTimeout(r, 5000));
    }
  }
};

const handler = async (msg, { conn, text }) => {
  const chatId = msg.key.remoteJid;
  await conn.sendMessage(chatId, { react: { text: "🎶", key: msg.key } });

  try {
    if (!text) {
      return conn.sendMessage(chatId, {
        text: `⚠️ *Debes escribir el nombre de una canción.*\n📌 Ejemplo:\n✳️ \`.play1 Boza Yaya\``
      }, { quoted: msg });
    }

    const search = await yts(text);
    if (!search.videos || !search.videos.length) throw new Error("No se encontraron resultados.");
    const video = search.videos[0];
    const { title, url, thumbnail } = video;
    const { downloadUrl } = await ddownr.download(url, "mp3");

    const tmp = path.resolve("./tmp");
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp);
    const raw = path.join(tmp, `${Date.now()}_raw.mp3`);
    const final = path.join(tmp, `${Date.now()}_final.mp3`);

    const audioStream = await axios.get(downloadUrl, { responseType: "stream" });
    await streamPipeline(audioStream.data, fs.createWriteStream(raw));

    await new Promise((resolve, reject) => {
      ffmpeg(raw)
        .audioBitrate("128k")
        .format("mp3")
        .on("end", resolve)
        .on("error", reject)
        .save(final);
    });

    await conn.sendMessage(chatId, {
      audio: fs.readFileSync(final),
      fileName: `${title}.mp3`,
      mimetype: "audio/mpeg",
      contextInfo: {
        externalAdReply: {
          title: title,
          body: "🎶 Reproducido por La Suki Bot",
          mediaType: 1,
          previewType: "PHOTO",
          thumbnailUrl: thumbnail,
          showAdAttribution: true,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: msg });

    fs.unlinkSync(raw);
    fs.unlinkSync(final);

  } catch (e) {
    console.error("❌ Error en el comando play1:", e);
    await conn.sendMessage(chatId, {
      text: "❌ *No se pudo descargar el audio.*\n🔹 Asegúrate de que el archivo no supere los 99MB."
    }, { quoted: msg });
  }
};

handler.command = ["play1"];
module.exports = handler;
