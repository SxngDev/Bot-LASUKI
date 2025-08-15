const fetch = require('node-fetch');

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const username = args.join(" ");
  const pref = global.prefixes?.[0] || ".";

  if (!username) {
    return conn.sendMessage(chatId, {
      text: `⚠️ *Uso incorrecto.*\n\n📌 *Ejemplo:* \`${pref}${command} russellxzpty\``
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, {
    react: { text: '⏳', key: msg.key }
  });

  try {
    const apiUrl = `https://api.dorratz.com/v3/tiktok-stalk?username=${encodeURIComponent(username)}`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);

    const { userInfo } = await res.json();
    if (!userInfo) throw new Error("No se pudo obtener la información del usuario.");

    const caption =
      `📱 *Perfil de TikTok*\n\n` +
      `👤 *Nombre:* ${userInfo.nombre}\n` +
      `📌 *Usuario:* @${userInfo.username}\n` +
      `🆔 *ID:* ${userInfo.id}\n` +
      `📝 *Bio:* ${userInfo.bio}\n` +
      `✅ *Verificado:* ${userInfo.verificado ? 'Sí' : 'No'}\n\n` +
      `📊 *Seguidores:* ${userInfo.seguidoresTotales}\n` +
      `👀 *Siguiendo:* ${userInfo.siguiendoTotal}\n` +
      `❤️ *Likes Totales:* ${userInfo.meGustaTotales}\n` +
      `🎥 *Videos:* ${userInfo.videosTotales}\n` +
      `🤝 *Amigos:* ${userInfo.amigosTotales}\n\n` +
      `🍧 *La Suki Bot* · dorratz.com`;

    await conn.sendMessage(chatId, {
      image: { url: userInfo.avatar },
      caption,
      mimetype: 'image/jpeg'
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: '✅', key: msg.key }
    });

  } catch (error) {
    console.error("❌ Error en .tiktokstalk:", error);
    await conn.sendMessage(chatId, {
      text: `❌ *Error al obtener perfil TikTok:*\n_${error.message}_`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: '❌', key: msg.key }
    });
  }
};

handler.command = ["tiktokstalk"];
module.exports = handler;
