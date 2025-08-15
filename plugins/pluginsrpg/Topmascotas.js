const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  // Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "🐾", key: msg.key } });

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath)) : {};
  db.usuarios = db.usuarios || [];

  if (db.usuarios.length === 0) {
    return conn.sendMessage(chatId, {
      text: "⚠️ No hay usuarios registrados en el RPG.",
      quoted: msg
    });
  }

  // Construir ranking de mascotas
  const ranking = db.usuarios
    .filter(u => u.mascotas && u.mascotas.length > 0)
    .map(u => {
      const totalNivel = u.mascotas.reduce((acc, m) => acc + (m.nivel || 0), 0);
      return {
        numero: u.numero,
        nombre: u.nombre,
        apellido: u.apellido,
        totalNivel,
        cantidad: u.mascotas.length,
        listaMascotas: u.mascotas.map(m => `${m.nombre} (Lvl ${m.nivel})`).join(", ")
      };
    })
    .sort((a, b) => b.totalNivel - a.totalNivel);

  if (ranking.length === 0) {
    return conn.sendMessage(chatId, {
      text: "⚠️ No hay mascotas registradas en el RPG.",
      quoted: msg
    });
  }

  // Armar mensaje
  let texto = `🐾 *🏆 TOP MASCOTAS - LA SUKI BOT 🏆*\n\n`;
  ranking.forEach((user, index) => {
    texto += `*${index + 1}.* @${user.numero}\n`;
    texto += `   📊 *Total Nivel:* ${user.totalNivel}\n`;
    texto += `   𖠁 *Cantidad de mascotas:* ${user.cantidad}\n`;
    texto += `   𖠁 *Mascotas:* ${user.listaMascotas}\n\n`;
  });

  await conn.sendMessage(chatId, {
    image: { url: "https://cdn.russellxz.click/1745315f.jpeg" },
    caption: texto,
    mentions: ranking.map(u => `${u.numero}@s.whatsapp.net`),
    quoted: msg
  });
};

handler.command = ["topmascotas", "topmas"];
module.exports = handler;
