const SpeakEngine = require("google-tts-api");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const pref = global.prefixes?.[0] || ".";
  const command = "tts";

  try {
    await conn.sendMessage(chatId, {
      react: { text: "🗣️", key: msg.key }
    });

    let textToSay = args.join(" ").trim();

    if (!textToSay && quoted) {
      textToSay =
        quoted.conversation ||
        quoted?.extendedTextMessage?.text ||
        quoted?.imageMessage?.caption ||
        quoted?.videoMessage?.caption || "";
    }

    if (!textToSay) {
      return conn.sendMessage(chatId, {
        text: `⚠️ *Proporciona un texto o responde a un mensaje para convertirlo a voz.*\n✳️ *Ejemplo:* \`${pref}${command} hola mundo\``
      }, { quoted: msg });
    }

    await conn.sendPresenceUpdate("recording", chatId);

    const audioUrl = SpeakEngine.getAudioUrl(textToSay, {
      lang: "es",
      slow: false,
      host: "https://translate.google.com",
    });

    await conn.sendMessage(chatId, {
      audio: { url: audioUrl },
      mimetype: "audio/mpeg",
      ptt: true,
      fileName: "tts.mp3"
    }, { quoted: msg });

  } catch (error) {
    console.error("❌ Error en el comando tts:", error);
    await conn.sendMessage(chatId, {
      text: "❌ *Ocurrió un error al convertir texto a voz.*"
    }, { quoted: msg });
  }
};

handler.command = ["tts"];
module.exports = handler;
