const fs = require("fs");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  await conn.sendMessage(chatId, {
    react: { text: "📦", key: msg.key }
  });

  const guarPath = "./guar.json";
  if (!fs.existsSync(guarPath)) {
    return conn.sendMessage(chatId, {
      text: "❌ *Error:* No hay multimedia guardado aún. Usa `.guar` para guardar algo primero.",
    }, { quoted: msg });
  }

  let guarData = JSON.parse(fs.readFileSync(guarPath, "utf-8"));
  let cambios = false;

  // Limpiar paquetes vacíos
  for (const key in guarData) {
    if (!Array.isArray(guarData[key]) || guarData[key].length === 0) {
      delete guarData[key];
      cambios = true;
    }
  }

  if (cambios) {
    fs.writeFileSync(guarPath, JSON.stringify(guarData, null, 2));
  }

  if (Object.keys(guarData).length === 0) {
    return conn.sendMessage(chatId, {
      text: "📂 *Lista vacía:* No hay paquetes con contenido."
    }, { quoted: msg });
  }

  let texto = "🎒 *Lista de paquetes guardados:*\n\n";
  const mentions = [];

  for (const key in guarData) {
    texto += `📁 *${key}* (${guarData[key].length} archivos):\n`;

    guarData[key].forEach((item, i) => {
      const num = item.user?.replace(/[^0-9]/g, "");
      const jid = num ? `${num}@s.whatsapp.net` : null;
      if (jid) mentions.push(jid);

      // Determinar tipo de archivo
      let tipo = "🗂 Desconocido";
      const ext = item.ext?.toLowerCase() || "";
      const mime = item.mime?.toLowerCase() || "";

      if (ext === "webp") tipo = "🖼 Sticker";
      else if (mime === "audio/ogg" || mime === "audio/opus") tipo = "🎙 Nota de Voz";
      else if (mime.startsWith("audio/")) tipo = "🎵 Audio";
      else if (mime.startsWith("video/")) tipo = "🎥 Video";
      else if (mime.startsWith("image/")) tipo = "🖼 Imagen";
      else if (mime.startsWith("application/")) tipo = "📄 Documento";

      texto += `   ${i + 1}. ${tipo} — Guardado por: ${jid ? `@${num}` : "🤷‍♂️ Desconocido"}\n`;
    });

    texto += "\n";
  }

  return conn.sendMessage(chatId, {
    text: texto.trim(),
    mentions
  }, { quoted: msg });
};

handler.command = ["verpacks"];
module.exports = handler;
