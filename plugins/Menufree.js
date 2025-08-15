const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";

  // Reacción al usar el comando
  await conn.sendMessage(chatId, { react: { text: "📋", key: msg.key } });

  const texto = `𖠺𝐿𝑎 𝑆𝑢𝑘𝑖 𝐵𝑜𝑡𖠺

𖠁𝗠𝗘𝗡𝗨 𝗙𝗥𝗘𝗘 𝗙𝗜𝗥𝗘𖠁
𖠁𝗣𝗿𝗲𝗳𝗶𝗷𝗼 𝗔𝗰𝘁𝘂𝗮𝗹: 『 ${pref} 』
𖠁𝗨𝘀𝗮 𝗲𝗻 𝗰𝗮𝗱𝗮 𝗰𝗼𝗺𝗮𝗻𝗱𝗼

🍉 *MAPAS*
╭─────◆
│๛ ${pref}mapas
╰─────◆

📃 *REGLAS*
╭─────◆
│๛ ${pref}reglas
│๛ ${pref}setreglas
╰─────◆

🛡️ *LISTA DE VERSUS*
╭─────◆
│๛ ${pref}4vs4
│๛ ${pref}6vs6
│๛ ${pref}12vs12
│๛ ${pref}16vs16
│๛ ${pref}20vs20
│๛ ${pref}24vs24
│๛ ${pref}guerr
╰─────◆

🎮 *Sistema personalizado para clanes FF*

🤖 *La Suki Bot*`.trim();

  await conn.sendMessage(chatId, {
    image: { url: 'https://cdn.russellxz.click/bdd4fca0.jpeg' },
    caption: texto
  }, { quoted: msg });
};

handler.command = ['menufree'];
handler.help = ['menufree'];
handler.tags = ['menu'];
handler.register = true;

module.exports = handler;
