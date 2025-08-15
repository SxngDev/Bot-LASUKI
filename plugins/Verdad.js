requireFromRoot = (mod) => require(require('path').join(__dirname, '..', mod));
requireFromRoot('config.js'); // 🔁 Asegura cargar el archivo donde están los arrays

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  try {
    if (!Array.isArray(global.verdad) || global.verdad.length === 0) {
      throw new Error("No hay verdades disponibles.");
    }

    const verdad = pickRandom(global.verdad);

    await conn.sendMessage(chatId, {
      react: { text: "🧐", key: msg.key }
    });

    await conn.sendMessage(chatId, {
      video: { url: 'https://cdn.russellxz.click/ee5ab947.mp4' },
      gifPlayback: true,
      caption: `𝘏𝘢𝘴 𝘦𝘴𝘤𝘰𝘨𝘪𝘥𝘰 *𝘝𝘌𝘙𝘋𝘈𝘋*\n\n╱╲❀╱╲╱╲❀╱╲╱╲❀╱╲\n◆ ${verdad}\n╲╱❀╲╱╲╱❀╲╱╲╱❀╲╱\n\n© La Suki Bot`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (e) {
    console.error("❌ Error en el comando .verdad:", e);
    await conn.sendMessage(chatId, {
      text: "❌ *Error:* " + e.message
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ['verdad'];
module.exports = handler;
