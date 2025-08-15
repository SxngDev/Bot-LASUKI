const axios = require("axios");
const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const text = args.join(" ");
  const pref = global.prefixes?.[0] || ".";

  if (!text) {
    return conn.sendMessage(chatId, {
      text: `✳️ *Usa:*\n${pref}${command} <enlace>\nEj: *${pref}${command}* https://vm.tiktok.com/ZMjdrFCtg/`
    }, { quoted: msg });
  }

  if (!/^https?:\/\//.test(args[0]) || !args[0].includes("tiktok")) {
    return conn.sendMessage(chatId, {
      text: "❌ *Enlace de TikTok inválido.*"
    }, { quoted: msg });
  }

  try {
    await conn.sendMessage(chatId, {
      react: { text: "⏱️", key: msg.key }
    });

    const response = await axios.get(`https://api.dorratz.com/v2/tiktok-dl?url=${args[0]}`);
    const data = response.data?.data;

    if (!data || !data.media?.org) {
      throw new Error("La API no devolvió un video válido.");
    }

    const videoUrl = data.media.org;
    const videoTitle = data.title || "Sin título";
    const videoAuthor = data.author?.nickname || "Desconocido";
    const videoDuration = data.duration ? `${data.duration} segundos` : "No especificado";
    const videoLikes = data.like || "0";
    const videoComments = data.comment || "0";

    const tmpDir = path.resolve("./tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const filePath = path.join(tmpDir, `tt-${Date.now()}.mp4`);
    const videoRes = await axios.get(videoUrl, { responseType: "stream" });
    const writer = fs.createWriteStream(filePath);

    await new Promise((resolve, reject) => {
      videoRes.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB > 99) {
      fs.unlinkSync(filePath);
      return conn.sendMessage(chatId, {
        text: `❌ El archivo pesa ${sizeMB.toFixed(2)}MB y excede el límite de 99MB.`
      }, { quoted: msg });
    }

    const caption = `🎵 *𝑽𝒊𝒅𝒆𝒐 𝒅𝒆 𝑻𝒊𝒌𝑻𝒐𝒌 𝑫𝒆𝒔𝒄𝒂𝒓𝒈𝒂𝒅𝒐* 🎵\n\n𖠁 *Título:* ${videoTitle}\n𖠁 *Autor:* ${videoAuthor}\n𖠁 *Duración:* ${videoDuration}\n𖠁 *Likes:* ${videoLikes}\n𖠁 *Comentarios:*\n${videoComments}\n𖠁 *API:* api.dorratz.com\n────────────\n🤖 _La Suki Bot_`;

    await conn.sendMessage(chatId, {
      video: fs.readFileSync(filePath),
      mimetype: "video/mp4",
      caption
    }, { quoted: msg });

    fs.unlinkSync(filePath);

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (error) {
    console.error("❌ Error en el comando TikTok:", error);
    await conn.sendMessage(chatId, {
      text: "❌ *Ocurrió un error al procesar el enlace de TikTok.*"
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ["tiktok", "tt"];
module.exports = handler;
