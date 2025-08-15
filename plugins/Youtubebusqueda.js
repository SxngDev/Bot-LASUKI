const axios = require("axios");

const handler = async (msg, { conn, args, text }) => {
  const chatId = msg.key.remoteJid;

  if (!args.length) {
    return conn.sendMessage(chatId, {
      text: `⚠️ *Uso incorrecto del comando.*\n\n📌 Ejemplo:\n✳️ \`.yts Bad Bunny Ojitos Lindos\``,
    }, { quoted: msg });
  }

  const query = args.join(" ");
  const apiUrl = `https://api.dorratz.com/v3/yt-search?query=${encodeURIComponent(query)}`;

  // ⏳ Reacción de carga
  await conn.sendMessage(chatId, {
    react: { text: "⏳", key: msg.key }
  });

  try {
    const response = await axios.get(apiUrl);
    const { data } = response.data;

    if (!data || data.length === 0) {
      throw new Error("No se encontraron resultados para ese texto.");
    }

    let texto = `🔍 *Resultados para:* ${query}\n\n`;

    texto += data.slice(0, 5).map((v, i) => `
🔸 *${i + 1}. ${v.title}*
👤 *Canal:* ${v.author.name}
🕒 *Duración:* ${v.duration}
📅 *Publicado:* ${v.publishedAt}
👁️ *Vistas:* ${v.views.toLocaleString()}
🔗 *Enlace:* ${v.url}
    `.trim()).join("\n\n");

    const thumbnail = data[0].thumbnail;

    await conn.sendMessage(chatId, {
      image: { url: thumbnail },
      caption: texto,
      mimetype: "image/jpeg"
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (error) {
    console.error("❌ Error en el comando .yts:", error.message);
    await conn.sendMessage(chatId, {
      text: `❌ *Error al buscar en YouTube:*\n_${error.message}_`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ["yts", "ytsearch"];
module.exports = handler;
