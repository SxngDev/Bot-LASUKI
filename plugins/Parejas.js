const axios = require("axios");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  try {
    if (!chatId.endsWith("@g.us")) {
      return conn.sendMessage(chatId, {
        text: "❌ *Este comando solo funciona en grupos.*"
      }, { quoted: msg });
    }

    await conn.sendMessage(chatId, {
      react: { text: "💞", key: msg.key }
    });

    const metadata = await conn.groupMetadata(chatId);
    let participants = metadata.participants.map(p => p.id);

    if (participants.length < 2) {
      return conn.sendMessage(chatId, {
        text: "⚠️ *Se necesitan al menos 2 personas en el grupo para formar parejas.*"
      }, { quoted: msg });
    }

    participants = participants.sort(() => Math.random() - 0.5);

    const parejas = [];
    const max = Math.min(5, Math.floor(participants.length / 2));
    for (let i = 0; i < max; i++) {
      parejas.push([participants.pop(), participants.pop()]);
    }

    const solo = participants.length === 1 ? participants[0] : null;

    const frases = [
      "🌹 *Un amor destinado...*",
      "💞 *¡Esta pareja tiene química!*",
      "❤️ *¡Qué hermosos juntos!*",
      "💕 *Cupido hizo su trabajo...*",
      "💑 *Parece que el destino los unió.*"
    ];

    let mensaje = `💖 *Parejas del Grupo* 💖\n\n`;
    parejas.forEach((par, i) => {
      mensaje += `💍 *Pareja ${i + 1}:* @${par[0].split("@")[0]} 💕 @${par[1].split("@")[0]}\n`;
      mensaje += `📜 ${frases[Math.floor(Math.random() * frases.length)]}\n\n`;
    });

    if (solo) {
      mensaje += `😢 *@${solo.split("@")[0]} se quedó sin pareja...* 💔\n`;
    }

    mensaje += `\n🌟 *¿Será el inicio de una gran historia de amor?*\n\n────────────\n💘 _La Suki Bot_`;

    let imageBuffer = null;
    try {
      const response = await axios.get("https://cdn.dorratz.com/files/1741340936306.jpg", { responseType: "arraybuffer" });
      imageBuffer = Buffer.from(response.data);
    } catch (e) {
      console.error("❌ Error al descargar imagen de pareja:", e);
    }

    const mentionList = parejas.flat().concat(solo ? [solo] : []);
    if (imageBuffer) {
      await conn.sendMessage(chatId, {
        image: imageBuffer,
        caption: mensaje,
        mentions: mentionList
      }, { quoted: msg });
    } else {
      await conn.sendMessage(chatId, {
        text: mensaje,
        mentions: mentionList
      }, { quoted: msg });
    }

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (err) {
    console.error("❌ Error en .pareja:", err);
    await conn.sendMessage(chatId, {
      text: "❌ *Ocurrió un error al formar parejas.*"
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ["pareja", "parejas"];
module.exports = handler;
