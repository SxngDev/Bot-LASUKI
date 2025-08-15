const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const handler = async (msg, { conn, command }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";

  try {
    await conn.sendMessage(chatId, {
      react: { text: "🎞️", key: msg.key }
    });

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted || !quoted.videoMessage) {
      return conn.sendMessage(chatId, {
        text: `✳️ *Usa:*\n${pref}${command}\n📌 Responde a un video para convertirlo en estilo GIF largo.`
      }, { quoted: msg });
    }

    const stream = await downloadContentFromMessage(quoted.videoMessage, "video");
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    await conn.sendMessage(chatId, {
      video: buffer,
      gifPlayback: true,
      caption: "🎬 *Video convertido al estilo GIF largo (sin audio)*\n\n🍧 _La Suki Bot_"
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (error) {
    console.error("❌ Error en el comando gifvideo:", error);
    await conn.sendMessage(chatId, {
      text: "❌ *Ocurrió un error al procesar el video.*"
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ["gifvideo"];
handler.help = ["gifvideo"];
handler.tags = ["tools"];
handler.register = true;

module.exports = handler;
