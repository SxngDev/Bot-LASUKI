const axios = require("axios");
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { promisify } = require("util");
const { pipeline } = require("stream");
const streamPipe = promisify(pipeline);

// Almacena tareas pendientes por previewMessageId
const pending = {};

module.exports = async (msg, { conn, text }) => {
  const pref = global.prefixes?.[0] || ".";

  if (!text || !text.trim()) {
  return conn.sendMessage(
    msg.key.remoteJid,
    { text: `✳️ Usa:\n${pref}play <término>\nEj: *${pref}play* bad bunny diles` },
    { quoted: msg }
  );
}
  // reacción de carga
  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "⏳", key: msg.key }
  });

  // búsqueda
  const res = await yts(text);
  const video = res.videos[0];
  if (!video) {
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: "❌ Sin resultados." },
      { quoted: msg }
    );
  }

  const { url: videoUrl, title, timestamp: duration, views, author } = video;
  const viewsFmt = views.toLocaleString();

  const caption = `

❦𝑳𝑨 𝑺𝑼𝑲𝑰 𝑩𝑶𝑻❦

📀𝙸𝚗𝚏𝚘 𝚍𝚎𝚕 𝚟𝚒𝚍𝚎𝚘:

❥𝑻𝒊𝒕𝒖𝒍𝒐: ${title}
❥𝑫𝒖𝒓𝒂𝒄𝒊𝒐𝒏: ${duration}
❥𝑽𝒊𝒔𝒕𝒂𝒔: ${viewsFmt}
❥𝑨𝒖𝒕𝒐𝒓: ${author}
❥𝑳𝒊𝒏𝒌: ${videoUrl}

📥 𝙾𝚙𝚌𝚒𝚘𝚗𝚎𝚜 𝚍𝚎 𝙳𝚎𝚜𝚌𝚊𝚛𝚐𝚊 𝚛𝚎𝚊𝚌𝚒𝚘𝚗𝚎 𝚘 𝚛𝚎𝚜𝚙𝚘𝚗𝚍𝚊 𝚎𝚕 𝚖𝚎𝚗𝚜𝚊𝚓𝚎 𝚍𝚎𝚕 𝚋𝚘𝚝🎮:
☛ 👍 Audio MP3     (1 / audio)
☛ ❤️ Video MP4     (2 / video)
☛ 📄 Audio Doc     (4 / audiodoc)
☛ 📁 Video Doc     (3 / videodoc)
 
❦𝑳𝑨 𝑺𝑼𝑲𝑰 𝑩𝑶𝑻❦
`.trim();

  // envía preview
  const preview = await conn.sendMessage(
    msg.key.remoteJid,
    { image: { url: video.thumbnail }, caption },
    { quoted: msg }
  );

  // guarda trabajo
  pending[preview.key.id] = {
    chatId: msg.key.remoteJid,
    videoUrl,
    title,
    commandMsg: msg,
    done: { audio: false, video: false, audioDoc: false, videoDoc: false }
  };

  // confirmación
  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "✅", key: msg.key }
  });

  // listener único
  if (!conn._playproListener) {
    conn._playproListener = true;
    conn.ev.on("messages.upsert", async ev => {
      for (const m of ev.messages) {
        // 1) REACCIONES
        if (m.message?.reactionMessage) {
          const { key: reactKey, text: emoji } = m.message.reactionMessage;
          const job = pending[reactKey.id];
          if (job) {
            await handleDownload(conn, job, emoji, job.commandMsg);
          }
        }

        // 2) RESPUESTAS CITADAS
        try {
          const context = m.message?.extendedTextMessage?.contextInfo;
          const citado = context?.stanzaId;
          const texto = (
            m.message?.conversation?.toLowerCase() ||
            m.message?.extendedTextMessage?.text?.toLowerCase() ||
            ""
          ).trim();
          const job = pending[citado];
          const chatId = m.key.remoteJid;
          if (citado && job) {
            // AUDIO
            if (["1", "audio", "4", "audiodoc"].includes(texto)) {
              const docMode = ["4", "audiodoc"].includes(texto);
              await conn.sendMessage(chatId, { react: { text: docMode ? "📄" : "🎵", key: m.key } });
              await conn.sendMessage(chatId, { text: `🎶 Descargando audio...` }, { quoted: m });
              await downloadAudio(conn, job, docMode, m);
            }
            // VIDEO
            else if (["2", "video", "3", "videodoc"].includes(texto)) {
              const docMode = ["3", "videodoc"].includes(texto);
              await conn.sendMessage(chatId, { react: { text: docMode ? "📁" : "🎬", key: m.key } });
              await conn.sendMessage(chatId, { text: `🎥 Descargando video...` }, { quoted: m });
              await downloadVideo(conn, job, docMode, m);
            }
            // AYUDA
            else {
              await conn.sendMessage(chatId, {
                text: `⚠️ Opciones válidas:\n1/audio, 4/audiodoc → audio\n2/video, 3/videodoc → video`
              }, { quoted: m });
            }

            // elimina de pending después de 5 minutos
            if (!job._timer) {
              job._timer = setTimeout(() => delete pending[citado], 5 * 60 * 1000);
            }
          }
        } catch (e) {
          console.error("Error en detector citado:", e);
        }
      }
    });
  }
};

async function handleDownload(conn, job, choice, quotedMsg) {
  const mapping = {
    "👍": "audio",
    "❤️": "video",
    "📄": "audioDoc",
    "📁": "videoDoc"
  };
  const key = mapping[choice];
  if (key) {
    const isDoc = key.endsWith("Doc");
    await conn.sendMessage(job.chatId, { text: `⏳ Descargando ${isDoc ? "documento" : key}…` }, { quoted: job.commandMsg });
    if (key.startsWith("audio")) await downloadAudio(conn, job, isDoc, job.commandMsg);
    else await downloadVideo(conn, job, isDoc, job.commandMsg);
  }
}

async function downloadAudio(conn, job, asDocument, quoted) {
  const { chatId, videoUrl, title } = job;
  const api = `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(videoUrl)}&type=audio&quality=128kbps&apikey=russellxz`;
  const res = await axios.get(api);
  if (!res.data?.status || !res.data.data?.url) throw new Error("No se pudo obtener el audio");
  const tmp = path.join(__dirname, "../tmp");
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp);
  const inFile = path.join(tmp, `${Date.now()}_in.m4a`);
  const outFile = path.join(tmp, `${Date.now()}_out.mp3`);
  const download = await axios.get(res.data.data.url, { responseType: "stream" });
  await streamPipe(download.data, fs.createWriteStream(inFile));
  await new Promise((r, e) => ffmpeg(inFile).audioCodec("libmp3lame").audioBitrate("128k").format("mp3").save(outFile).on("end", r).on("error", e));
  const buffer = fs.readFileSync(outFile);
  await conn.sendMessage(chatId, {
    [asDocument ? "document" : "audio"]: buffer,
    mimetype: "audio/mpeg",
    fileName: `${title}.mp3`
  }, { quoted });
  fs.unlinkSync(inFile);
  fs.unlinkSync(outFile);
}

async function downloadVideo(conn, job, asDocument, quoted) {
  const { chatId, videoUrl, title } = job;
  const qualities = ["720p","480p","360p"];
  let url = null;
  for (let q of qualities) {
    try {
      const r = await axios.get(`https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(videoUrl)}&type=video&quality=${q}&apikey=russellxz`);
      if (r.data?.status && r.data.data?.url) { url = r.data.data.url; break; }
    } catch {}
  }
  if (!url) throw new Error("No se pudo obtener el video");
  const tmp = path.join(__dirname, "../tmp");
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp);
  const file = path.join(tmp, `${Date.now()}_vid.mp4`);
  const dl = await axios.get(url, { responseType: "stream" });
  await streamPipe(dl.data, fs.createWriteStream(file));
  await conn.sendMessage(chatId, {
    [asDocument ? "document" : "video"]: fs.readFileSync(file),
    mimetype: "video/mp4",
    fileName: `${title}.mp4`,
    caption: asDocument ? undefined : `🎬 𝐀𝐪𝐮𝐢́ 𝐭𝐢𝐞𝐧𝐞𝐬 𝐭𝐮 𝐯𝐢𝐝𝐞𝐨~ 💫\n© 𝐋𝐚 𝐒𝐮𝐤𝐢 𝐁𝐨𝐭`
  }, { quoted });
  fs.unlinkSync(file);
}

module.exports.command = ["play"];
