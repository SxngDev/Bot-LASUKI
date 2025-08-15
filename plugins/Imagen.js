const fetch = require("node-fetch");

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const text = args.join(" ");
  const pref = global.prefixes?.[0] || ".";

  if (!text) {
    return conn.sendMessage(chatId, {
      text: `⚠️ *Uso incorrecto.*\n✳️ *Ejemplo:* \`${pref}${command} gatos\``
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, {
    react: { text: "⏳", key: msg.key }
  });

  try {
    const apiUrl = `https://api.neoxr.eu/api/goimg?q=${encodeURIComponent(text)}&apikey=russellxz`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Error de la API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.status || !data.data || data.data.length === 0) {
      throw new Error("No se encontraron imágenes.");
    }

    const image = data.data[0]; // Usamos la primera imagen

    const caption = `🖼️ *Imagen generada de:* ${text}\n🔗 *Fuente:* ${image.origin.website.url}\n\n────────────\n🤖 _La Suki Bot_`;

    await conn.sendMessage(chatId, {
      image: { url: image.url },
      caption,
      mimetype: "image/jpeg"
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (err) {
    console.error("❌ Error en el comando imagen:", err.message);
    await conn.sendMessage(chatId, {
      text: `❌ *Error al obtener la imagen:*\n_${err.message}_`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ["imagen"];
module.exports = handler;
