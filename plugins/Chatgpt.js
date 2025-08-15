const fetch = require("node-fetch");

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const text = args.join(" ");
  const userId = msg.key.participant || msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";

  if (!text) {
    return conn.sendMessage(chatId, {
      text: `⚠️ *Uso incorrecto.*\n✳️ *Ejemplo:* \`${pref}${command} Hola, ¿cómo estás?\``
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, {
    react: { text: "🤖", key: msg.key }
  });

  try {
    const apiUrl = `https://api.neoxr.eu/api/gpt4-session?q=${encodeURIComponent(text)}&session=1727468410446638&apikey=russellxz`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Error de la API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.status || !data.data?.message) {
      throw new Error("❌ No se pudo obtener una respuesta válida.");
    }

    const respuesta = data.data.message;

    await conn.sendMessage(chatId, {
      text: `🧠 *GPT-4 responde a @${userId.replace(/@s\\.whatsapp\\.net$/, "")}:*\n\n${respuesta}\n\n────────────\n🤖 _La Suki Bot_`,
      mentions: [userId]
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (error) {
    console.error("❌ Error en comando chatgpt:", error);
    await conn.sendMessage(chatId, {
      text: `❌ *Error al obtener respuesta de GPT-4:*\n_${error.message}_`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ["chatgpt"];
module.exports = handler;
