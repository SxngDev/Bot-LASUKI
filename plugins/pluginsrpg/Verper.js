// plugins/verper.js
const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const sender  = msg.key.participant || msg.key.remoteJid;
  const numero  = (sender || "").replace(/\D/g, "");

  await conn.sendMessage(chatId, { react: { text: "🦸", key: msg.key } });

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  const db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath)) : { usuarios: [] };

  const usuario = (db.usuarios || []).find(u => u.numero === numero);
  if (!usuario) {
    return conn.sendMessage(
      chatId,
      { text: "❌ No estás registrado en el RPG.\nUsa *.rpg nombre apellido edad fechaNacimiento* para registrarte." },
      { quoted: msg }
    );
  }

  if (!Array.isArray(usuario.personajes) || usuario.personajes.length === 0) {
    return conn.sendMessage(
      chatId,
      { text: "🦸 No tienes personajes aún.\nUsa *.comprar* para adquirir uno." },
      { quoted: msg }
    );
  }

  let texto = `🦸‍♂️ *Tus Personajes Comprados*\n\n`;

  usuario.personajes.forEach((p, i) => {
    // Normalizaciones seguras (por si faltan campos)
    const nombreP = String(p?.nombre || `Personaje ${i + 1}`);
    const nivelP  = Number(p?.nivel) || 1;
    const xpP     = Number(p?.xp) || 0;

    // Asegurar arreglo de habilidades y 2 slots mínimos
    let habs = Array.isArray(p?.habilidades) ? p.habilidades : [];
    while (habs.length < 2) {
      habs.push({ nombre: `Habilidad ${habs.length + 1}`, nivel: 1, xp: 0 });
    }

    // Normalizar cada habilidad (nivel/xp reales si existen)
    const h1 = habs[0] || {};
    const h2 = habs[1] || {};
    const h1Nombre = String(h1.nombre || "Habilidad 1");
    const h2Nombre = String(h2.nombre || "Habilidad 2");
    const h1Nivel  = Number(h1.nivel) || 1;
    const h2Nivel  = Number(h2.nivel) || 1;
    const h1XP     = Number(h1.xp) || 0;
    const h2XP     = Number(h2.xp) || 0;

    texto += `👤 *${i + 1}. ${nombreP}*\n`;
    texto += `🧬 Nivel: ${nivelP}  •  ✨ XP: ${xpP}\n`;
    texto += `🎯 Habilidades:\n`;
    texto += `   • ${h1Nombre} (Nv ${h1Nivel} • XP ${h1XP})\n`;
    texto += `   • ${h2Nombre} (Nv ${h2Nivel} • XP ${h2XP})\n`;
    texto += `──────────────\n`;
  });

  texto += `📌 *Comandos para subir de nivel tus personajes:*\n`;
  texto += `➤ .luchar  • .volar  • .enemigos • .poder • .podermaximo • .otromundo\n`;
  texto += `➤ .otrouniverso  • .mododios  • .mododiablo  • .superpoder\n`;
  texto += `➤ .batallaanime\n`;

  const portada = "https://cdn.russellxz.click/a671ee24.jpeg";

  await conn.sendMessage(
    chatId,
    { image: { url: portada }, caption: texto },
    { quoted: msg }
  );

  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["verper", "verpersonajes"];
module.exports = handler;
