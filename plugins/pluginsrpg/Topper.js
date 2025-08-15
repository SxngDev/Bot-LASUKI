const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  // Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "🏆", key: msg.key } });

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(sukirpgPath)
    ? JSON.parse(fs.readFileSync(sukirpgPath))
    : {};
  db.usuarios = db.usuarios || [];

  if (db.usuarios.length === 0) {
    return conn.sendMessage(chatId, {
      text: "❌ No hay usuarios registrados en el RPG.",
      quoted: msg
    });
  }

  // Calcular total de niveles por usuario
  const ranking = db.usuarios
    .map(user => {
      const totalNivel = (user.personajes || []).reduce((acc, p) => acc + (p.nivel || 0), 0);
      return {
        numero: user.numero,
        nombre: user.nombre || "Desconocido",
        apellido: user.apellido || "",
        personajes: user.personajes || [],
        totalNivel
      };
    })
    .sort((a, b) => b.totalNivel - a.totalNivel);

  // Crear texto del top
  let texto = `🏆 *TOP DE PERSONAJES MAS PODEROSOS🏆*\n\n`;
  for (let i = 0; i < ranking.length; i++) {
    const u = ranking[i];
    texto += `*${i + 1}.* @${u.numero}\n`;
    texto += `👤 *${u.nombre} ${u.apellido}*\n`;
    texto += `🎯 *Total Nivel:* ${u.totalNivel}\n`;
    texto += `🎭 *Cantidad de personajes:* ${u.personajes.length}\n`;
    if (u.personajes.length > 0) {
      texto += `📜 *Personajes:*\n`;
      u.personajes.forEach(p => {
        texto += `   - ${p.nombre} (Nivel ${p.nivel})\n`;
      });
    }
    texto += `─────────────────\n`;
  }

  // Enviar imagen con el ranking
  await conn.sendMessage(chatId, {
    image: { url: "https://cdn.russellxz.click/e2626fe3.jpeg" },
    caption: texto,
    mentions: ranking.map(u => `${u.numero}@s.whatsapp.net`),
    quoted: msg
  });
};

handler.command = ["topper"];
module.exports = handler;
