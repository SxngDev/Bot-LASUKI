const axios = require("axios");

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const text = args.join(" ");
  const pref = global.prefixes?.[0] || ".";
  const participant = msg.key.participant || msg.key.remoteJid;
  const userMention = "@" + participant.replace(/[^0-9]/g, "");

  try {
    await conn.sendMessage(chatId, {
      react: { text: "🎨", key: msg.key }
    });

    const query = text.trim();
    if (!query) {
      return conn.sendMessage(chatId, {
        text: `⚠️ *Uso incorrecto del comando.*\n✳️ *Ejemplo:* \`${pref}${command} un gato en el espacio\`\n🔹 Describe la imagen que deseas generar.`
      }, { quoted: msg });
    }

    await conn.sendMessage(chatId, {
      react: { text: "🔄", key: msg.key }
    });

    const apiUrl = `https://api.dorratz.com/v3/ai-image?prompt=${encodeURIComponent(query)}`;
    const response = await axios.get(apiUrl);
    const imageUrl = response.data?.data?.image_link;

    if (!imageUrl) {
      return conn.sendMessage(chatId, {
        text: "❌ *No se pudo generar la imagen.* Intenta con otra descripción."
      }, { quoted: msg });
    }

    await conn.sendMessage(chatId, {
      image: { url: imageUrl },
      caption:
        `🖼️ *Imagen generada para:* ${userMention}\n` +
        `📌 *Prompt:* ${query}\n\n🍧 *API:* api.dorratz.com\n────────────\n🤖 _La Suki Bot_`,
      mentions: [participant]
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (err) {
    console.error("❌ Error en comando visión:", err);
    await conn.sendMessage(chatId, {
      text: "❌ *Ocurrió un error al generar la imagen.*"
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ["visión"];
module.exports = handler;
