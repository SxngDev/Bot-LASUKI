const axios = require('axios');

const handler = async (msg, { conn, text, args, usedPrefix, command }) => {
  const chatId = msg.key.remoteJid;

  if (!args.length) {
    return await conn.sendMessage(chatId, {
      text: `⚠️ *Uso incorrecto del comando:*\n📌 ${usedPrefix + command} <consulta>\n\n✳️ Ejemplo:\n*${usedPrefix + command}* bad bunny`
    }, { quoted: msg });
  }

  const query = args.join(' ');
  const apiUrl = `https://api.dorratz.com/v2/tiktok-s?q=${encodeURIComponent(query)}`;

  await conn.sendMessage(chatId, {
    react: { text: "⏳", key: msg.key }
  });

  try {
    const response = await axios.get(apiUrl);

    if (response.data.status !== 200 || !response.data.data || response.data.data.length === 0) {
      return await conn.sendMessage(chatId, {
        text: "❌ *No se encontraron resultados para tu búsqueda.*"
      }, { quoted: msg });
    }

    const results = response.data.data.slice(0, 5);

    const resultText = results.map((video, i) => `
🎬 *Resultado ${i + 1}*
📹 *Título:* ${video.title}
👤 *Autor:* ${video.author.nickname} (@${video.author.username})
👁️‍🗨️ *Vistas:* ${video.play.toLocaleString()}
❤️ *Likes:* ${video.like.toLocaleString()}
💬 *Comentarios:* ${video.coment.toLocaleString()}
🔗 *Enlace:* ${video.url}
`).join('\n');

    await conn.sendMessage(chatId, {
      text: `🔍 *Resultados de búsqueda en TikTok para:* "${query}"\n\n${resultText}`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (err) {
    console.error("❌ Error en .tiktoksearch:", err);
    await conn.sendMessage(chatId, {
      text: "❌ *Ocurrió un error al buscar en TikTok.*"
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ['tiktoksearch'];
handler.help = ['tiktoksearch <query>'];
handler.tags = ['buscadores'];
handler.register = true;

module.exports = handler;
