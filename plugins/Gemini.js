const fetch = require("node-fetch");

const handler = async (msg, { conn, text, args }) => {
  const pref = global.prefixes?.[0] || ".";

  if (!args.length) {
    return await conn.sendMessage(msg.key.remoteJid, {
      text: `⚠️ *Uso incorrecto.*\n📌 Ejemplo:\n*${pref}geminis* ¿Cuál es la capital de Japón?`
    }, { quoted: msg });
  }

  const pregunta = args.join(" ");
  const userId = msg.key.participant || msg.key.remoteJid;

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "🤖", key: msg.key }
  });

  try {
    const apiURL = `https://api.neoxr.eu/api/gemini-chat?q=${encodeURIComponent(pregunta)}&apikey=russellxz`;
    const response = await fetch(apiURL);
    if (!response.ok) throw new Error(`Error de la API: ${response.status} ${response.statusText}`);

    const json = await response.json();
    if (!json?.data?.trim()) throw new Error("Respuesta vacía de Gemini.");

    const respuestaGemini = json.data.trim();

    await conn.sendMessage(msg.key.remoteJid, {
      text: `✨ *Gemini dice para @${userId.replace("@s.whatsapp.net", "")}:*\n\n${respuestaGemini}\n\n🔹 *Powered by La Suki Bot* 🤖`,
      mentions: [userId]
    }, { quoted: msg });

    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "✅", key: msg.key }
    });

  } catch (err) {
    console.error("❌ Error en el comando geminis:", err.message);
    await conn.sendMessage(msg.key.remoteJid, {
      text: `❌ *Error al obtener respuesta de Gemini:*\n_${err.message}_\n\n🔹 Inténtalo más tarde.`
    }, { quoted: msg });

    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ['geminis', 'gemini'];
module.exports = handler;
