const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";

  // Reacción al usar el comando
  await conn.sendMessage(chatId, {
    react: { text: "✨", key: msg.key }
  });

  const caption = `𖠺𝐿𝑎 𝑆𝑢𝑘𝑖 𝐵𝑜𝑡𖠺

𖠁𝙈𝙀𝙉𝙐 𝙂𝙀𝙉𝙀𝙍𝘼𝙇𖠁
𖠁𝗣𝗿𝗲𝗳𝗶𝗷𝗼 𝗔𝗰𝘁𝘂𝗮𝗹: 『 ${pref} 』
𖠁𝗨𝘀𝗮 𝗲𝗻 𝗰𝗮𝗱𝗮 𝗰𝗼𝗺𝗮𝗻𝗱𝗼

𖠁𝙄𝙉𝙁𝙊𝙍𝙈𝘼𝘾𝙄𝙊𝙉𖠁
╭─────◆
│๛ ${pref}ping
│๛ ${pref}speedtest
│๛ ${pref}creador
│๛ ${pref}info
╰─────◆

𖠁𝙈𝙀𝙉𝙐𝙎 𝘿𝙄𝙎𝙋𝙊𝙉𝙄𝘽𝙇𝙀𝙎𖠁
╭─────◆
│๛ ${pref}menugrupo
│๛ ${pref}menuaudio
│๛ ${pref}menurpg
│๛ ${pref}menuowner
│๛ ${pref}menufree
╰─────◆

𖠁PARA VENTAS 𖠁
╭─────◆
│๛ ${pref}setstock / stock
│๛ ${pref}setnetflix / netflix
│๛ ${pref}setpago / pago
│๛ ${pref}setcombos / combos
│๛ ${pref}setpeliculas / peliculas
│๛ ${pref}settramites / tramites
│๛ ${pref}setcanvas / canvas
│๛ ${pref}setreglas / reglas
│๛ ${pref}sorteo
│๛ ${pref}setsoporte / soporte
│๛ ${pref}setpromo / promo
│๛ ${pref}addfactura
│๛ ${pref}delfactura
│๛ ${pref}facpaga
│๛ ${pref}verfac
╰─────◆

𖠁𝙄𝘼 - 𝘾𝙃𝘼𝙏 𝘽𝙊𝙏𖠁
╭─────◆
│๛ ${pref}gemini
│๛ ${pref}chatgpt
│๛ ${pref}dalle
│๛ ${pref}visión
│๛ ${pref}visión2
│๛ ${pref}chat on/off
│๛ ${pref}luminai
╰─────◆

𖠁𝘿𝙀𝙎𝘾𝘼𝙍𝙂𝘼𖠁
╭─────◆
│๛ ${pref}play / play1 / play2 / play3
│๛ ${pref}ytmp3 / ytmp4 / ytmp3doc / ytmp4doc
│๛ ${pref}tiktok / fb / ig / spotify
│๛ ${pref}mediafire / apk
╰─────◆

𖠁𝘽𝙐𝙎𝘾𝘼𝘿𝙊𝙍𝙀𝙎𖠁
╭─────◆
│๛ ${pref}pixai
│๛ ${pref}tiktoksearch
│๛ ${pref}yts
│๛ ${pref}tiktokstalk
╰─────◆

𖠁𝘾𝙊𝙉𝙑𝙀𝙍𝙏𝙄𝘿𝙊𝙍𝙀𝙎𖠁
╭─────◆
│๛ ${pref}tomp3
│๛ ${pref}toaudio
│๛ ${pref}hd
│๛ ${pref}tts
│๛ ${pref}tovideo / toimg
│๛ ${pref}gifvideo / ff / ff2
╰─────◆

𖠁𝙎𝙏𝙄𝘾𝙆𝙀𝙍𝙎𖠁
╭─────◆
│๛ ${pref}s / qc / qc2 / texto
│๛ ${pref}mixemoji / aniemoji
│๛ ${pref}addco / delco
╰─────◆

𖠁𝙃𝙀𝙍𝙍𝘼𝙈𝙄𝙀𝙉𝙏𝘼𝙎𖠁
╭─────◆
│๛ ${pref}ver / perfil / get / xxx
│๛ ${pref}tourl / whatmusic
╰─────◆

𖠁𝙈𝙄𝙉𝙄 𝙅𝙐𝙀𝙂𝙊𝙎𖠁 
╭─────◆
│๛ ${pref}verdad / reto
│๛ ${pref}personalidad
│๛ ${pref}parejas / ship
│๛ ${pref}menurpg
╰─────◆

✨ Gracias por usar *La Suki Bot*. Eres adorable 💖
`.trim();

  await conn.sendMessage(chatId, {
    video: { url: 'https://cdn.russellxz.click/a289f34c.mp4' },
    gifPlayback: true,
    caption
  }, { quoted: msg });
};

handler.command = ['menu'];
handler.help = ['menu'];
handler.tags = ['menu'];

module.exports = handler;
