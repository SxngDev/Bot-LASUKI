const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  await conn.sendMessage(chatId, {
    react: { text: "🎵", key: msg.key }
  });

  const guarPath = path.resolve("./guar.json");
  const guarData = fs.existsSync(guarPath)
    ? JSON.parse(fs.readFileSync(guarPath, "utf-8"))
    : {};

  const paquetes = Object.entries(guarData);
  const total = paquetes.length;

  const caption = `𖠺𝐿𝑎 𝑆𝑢𝑘𝑖 𝐵𝑜𝑡𖠺

𖠁🗂️ 𝙋𝘼𝙌𝙐𝙀𝙏𝙀𝙎 𝘿𝙀 𝙈𝙐𝙇𝙏𝙄𝙈𝙀𝘿𝙄𝘼𖠁
🎧 Audios, 🎞️ videos, 🖼️ imágenes, 🧩 stickers y más...

📝 *¿Cómo funciona?*
Solo escribe el *nombre del paquete* en el chat y *La Suki Bot* enviará al azar uno de los archivos guardados dentro de ese paquete.

📥 Para *guardar multimedia* responde a cualquier imagen, audio, sticker o video con:
➤ *.guar nombreDelPaquete*

🗑️ Para *borrar un archivo específico* de un paquete:
➤ *.del nombreDelPaquete número*

🔍 Para *ver un archivo específico* de un paquete:
➤ *.g nombreDelPaquete número*

📦 Todos los paquetes son públicos y compartidos entre los usuarios del grupo.

━━━━━━━━━━━━━━━

📦 *Paquetes disponibles:* ${total}

${
  total > 0
    ? "╭─────◆\n" +
      paquetes
        .map(([key, arr], i) => `│๛ ${key} [${arr.length} archivo${arr.length > 1 ? "s" : ""}]`)
        .join("\n") +
      "\n╰─────◆"
    : "❌ No hay multimedia guardada aún. Usa *.guar nombre* para comenzar."
}
`.trim();

  await conn.sendMessage(chatId, {
    video: { url: 'https://cdn.russellxz.click/18bf4be2.mp4' },
    gifPlayback: true,
    caption
  }, { quoted: msg });
};

handler.command = ["menuaudio"];
handler.help = ["menuaudio"];
handler.tags = ["menu"];
handler.register = true;

module.exports = handler;
