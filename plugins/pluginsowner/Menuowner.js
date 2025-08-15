const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";

  // Reacción única
  await conn.sendMessage(chatId, {
    react: { text: "👑", key: msg.key }
  });

  const caption = `╔════════════════╗
   👑 𝙼𝙴𝙽𝚄 𝙳𝙴 𝙾𝚆𝙽𝙴𝚁 👑
╚════════════════╝

🧩 *COMANDOS EXCLUSIVOS*
╭─────◆
│๛ ${pref}bc
│๛ ${pref}bc2
│๛ ${pref}rest
│๛ ${pref}carga
│๛ ${pref}modoprivado on/off
│๛ ${pref}botfoto
│๛ ${pref}botname
│๛ ${pref}setprefix
│๛ ${pref}git
│๛ ${pref}re
│๛ ${pref}unre
│๛ ${pref}autoadmins
│๛ ${pref}antideletepri on/off
│๛ ${pref}apagado
│๛ ${pref}addlista
│๛ ${pref}dellista
│๛ ${pref}vergrupos
│๛ ${pref}addowner
│๛ ${pref}delowner
│๛ ${pref}dar
│๛ ${pref}deleterpg
│๛ ${pref}addfactura
│๛ ${pref}delfactura
│๛ ${pref}facpaga
│๛ ${pref}verfac
╰─────◆

🤖 *La Suki Bot - Modo Dios activado*
`.trim();

  await conn.sendMessage(chatId, {
    video: { url: 'https://cdn.russellxz.click/a0b60c86.mp4' },
    gifPlayback: true,
    caption
  }, { quoted: msg });
};

handler.command = ['menuowner', 'ownermenu'];
handler.help = ['menuowner'];
handler.tags = ['menu'];

module.exports = handler;
