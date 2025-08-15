const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  // 🐾 Reacción inicial
  await conn.sendMessage(chatId, {
    react: { text: "🐾", key: msg.key }
  });

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");

  let db = {};
  if (fs.existsSync(sukirpgPath)) {
    db = JSON.parse(fs.readFileSync(sukirpgPath));
  }

  const mascotas = db.mascotas || [];

  if (!mascotas.length) {
    return conn.sendMessage(chatId, {
      text: "🚫 No hay mascotas disponibles en la tienda por ahora.",
      quoted: msg
    });
  }

  // Armar texto con total
  let texto = `🐾 *TIENDA DE MASCOTAS* 🐾\n`;
  texto += `📊 Total de mascotas: *${mascotas.length}*\n\n`;
  texto += `📌 Usa: *.comprarmas número* o *.comprarmas nombre*\nEj: *.comprarmas 1* o *.comprarmas 🐶Pikachu*\n\n`;

  mascotas.forEach((m, index) => {
    texto += `🔢 *#${index + 1}*\n`;
    texto += `✨️ *Nombre:* ${m.nombre.replace(/_/g, " ")}\n`;
    texto += `📈 *Nivel:* ${m.nivel || 1}\n`;
    texto += `💳 *Precio:* ${m.precio} créditos\n`;
    texto += `🌀 *Habilidades:*\n`;
    m.habilidades.forEach((h, i) => {
      texto += `   ${i + 1}. ${h.nombre.replace(/_/g, " ")} (Nivel ${h.nivel || 1})\n`;
    });
    texto += `────────────────────\n`;
  });

  await conn.sendMessage(chatId, {
    image: { url: "https://cdn.russellxz.click/2861878d.jpeg" },
    caption: texto
  }, { quoted: msg });

  await conn.sendMessage(chatId, {
    react: { text: "✅", key: msg.key }
  });
};

handler.command = ["tiendamas", "tiendamascota", "tiendamascotas"];
module.exports = handler;
