const fetch = require('node-fetch');
const axios = require('axios');

const apis = {
  delirius: 'https://delirius-apiofc.vercel.app/',
  ryzen: 'https://apidl.asepharyana.cloud/',
  rioo: 'https://restapi.apibotwa.biz.id/'
};

const handler = async (msg, { conn, text }) => {
  const chatId = msg.key.remoteJid;

  await conn.sendMessage(chatId, {
    react: { text: "🎶", key: msg.key }
  });

  if (!text) {
    return conn.sendMessage(chatId, {
      text: `⚠️ *Debes escribir el nombre de una canción.*\n📌 Ejemplo:\n✳️ \`.play3 Marshmello - Alone\``
    }, { quoted: msg });
  }

  try {
    const res = await axios.get(`${apis.delirius}search/spotify?q=${encodeURIComponent(text)}&limit=1`);
    const result = res.data.data?.[0];
    if (!result) throw '❌ No se encontraron resultados en Spotify.';

    const { title, artist, duration, publish, popularity, url, image } = result;

    const info = `🎵 *Resultado encontrado:*\n\n` +
                 `📌 *Título:* ${title}\n` +
                 `🎤 *Artista:* ${artist}\n` +
                 `⏱️ *Duración:* ${duration}\n` +
                 `📅 *Publicado:* ${publish}\n` +
                 `🔥 *Popularidad:* ${popularity}\n` +
                 `🔗 *Enlace:* ${url}\n\n` +
                 `✨ *La Suki Bot está enviando tu música...*`;

    await conn.sendMessage(chatId, {
      image: { url: image },
      caption: info
    }, { quoted: msg });

    const sendAudio = async (link) => {
      await conn.sendMessage(chatId, {
        audio: { url: link },
        fileName: `${title}.mp3`,
        mimetype: 'audio/mpeg'
      }, { quoted: msg });
    };

    // Intento 1
    try {
      const r1 = await fetch(`${apis.delirius}download/spotifydl?url=${encodeURIComponent(url)}`);
      const j1 = await r1.json();
      return await sendAudio(j1.data.url);
    } catch (e1) {
      // Intento 2
      try {
        const r2 = await fetch(`${apis.delirius}download/spotifydlv3?url=${encodeURIComponent(url)}`);
        const j2 = await r2.json();
        return await sendAudio(j2.data.url);
      } catch (e2) {
        // Intento 3
        try {
          const r3 = await fetch(`${apis.rioo}api/spotify?url=${encodeURIComponent(url)}`);
          const j3 = await r3.json();
          return await sendAudio(j3.data.response);
        } catch (e3) {
          // Intento 4
          try {
            const r4 = await fetch(`${apis.ryzen}api/downloader/spotify?url=${encodeURIComponent(url)}`);
            const j4 = await r4.json();
            return await sendAudio(j4.link);
          } catch (e4) {
            await conn.sendMessage(chatId, {
              text: `❌ *No se pudo descargar el audio.*\n🔹 _Error:_ ${e4.message}`
            }, { quoted: msg });
          }
        }
      }
    }

  } catch (err) {
    console.error("❌ Error en el comando .play3:", err);
    await conn.sendMessage(chatId, {
      text: `❌ *Ocurrió un error:* ${err.message || err}`
    }, { quoted: msg });
  }
};

handler.command = ["play3"];
module.exports = handler;
