// plugins/vermascotas.js
const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const sender  = msg.key.participant || msg.key.remoteJid;
  const numero  = (sender || "").replace(/\D/g, "");

  await conn.sendMessage(chatId, { react: { text: "🐾", key: msg.key } });

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

  if (!Array.isArray(usuario.mascotas) || usuario.mascotas.length === 0) {
    return conn.sendMessage(
      chatId,
      { text: "🐾 No tienes mascotas aún.\nUsa *.comprarmas* para comprar una." },
      { quoted: msg }
    );
  }

  let texto = `🐶 *Tus Mascotas Compradas*\n\n`;

  usuario.mascotas.forEach((m, i) => {
    const nombreM = String(m?.nombre || `Mascota ${i + 1}`);
    const nivelM  = Number(m?.nivel) || 1;
    const xpM     = Number(m?.xp) || 0;

    // Asegurar habilidades
    let habs = Array.isArray(m?.habilidades) ? m.habilidades : [];
    while (habs.length < 2) {
      habs.push({ nombre: `Habilidad Mascota ${habs.length + 1}`, nivel: 1, xp: 0 });
    }

    const h1 = habs[0] || {};
    const h2 = habs[1] || {};
    const h1Nombre = String(h1.nombre || "Habilidad 1");
    const h2Nombre = String(h2.nombre || "Habilidad 2");
    const h1Nivel  = Number(h1.nivel) || 1;
    const h2Nivel  = Number(h2.nivel) || 1;
    const h1XP     = Number(h1.xp) || 0;
    const h2XP     = Number(h2.xp) || 0;

    texto += `📦 *${i + 1}. ${nombreM}*\n`;
    texto += `🧬 Nivel: ${nivelM}  •  ✨ XP: ${xpM}\n`;
    texto += `🎯 Habilidades:\n`;
    texto += `   • ${h1Nombre} (Nv ${h1Nivel} • XP ${h1XP})\n`;
    texto += `   • ${h2Nombre} (Nv ${h2Nivel} • XP ${h2XP})\n`;
    texto += `──────────────\n`;
  });

  texto += `📌 *Comandos para subir de nivel tus mascotas:*\n`;
  texto += `➤ .daragua\n`;
  texto += `➤ .darcomida\n`;
  texto += `➤ .darcariño\n`;
  texto += `➤ .entrenar\n`;
  texto += `➤ .cazar\n`;
  texto += `➤ .presumir\n`;
  texto += `➤ .pasear\n`;
  texto += `➤ .supermascota\n`;
  texto += `➤ .batallamascota\n`;
  texto += `➤ .mascota (para cambiar de mascota principal)\n`;

  const portada = "https://cdn.russellxz.click/25e8051c.jpeg";

  await conn.sendMessage(
    chatId,
    { image: { url: portada }, caption: texto },
    { quoted: msg }
  );

  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["vermascotas", "vermas"];
module.exports = handler;
