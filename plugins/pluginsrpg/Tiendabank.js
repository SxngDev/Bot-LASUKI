// plugins/tiendabank.js
const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  // Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "🏦", key: msg.key } });

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  const db = fs.existsSync(sukirpgPath)
    ? JSON.parse(fs.readFileSync(sukirpgPath))
    : {};

  // Asegurar estructuras
  db.banco = db.banco || {};
  db.banco.tiendaPersonajesBanco = db.banco.tiendaPersonajesBanco || [];

  const tienda = db.banco.tiendaPersonajesBanco;

  if (!tienda.length) {
    return conn.sendMessage(
      chatId,
      {
        image: { url: "https://cdn.russellxz.click/4ec1a962.jpeg" },
        caption:
          "🏦 *Tienda del Banco*\n\n" +
          "Por ahora no hay personajes decomisados en venta.\n\n" +
          "Cuando el banco decomise personajes por impago, aparecerán aquí.\n" +
          "Para comprar, usa: *.comprarbank <número|nombre>*",
      },
      { quoted: msg }
    );
  }

  // Construir listado
  let texto = "🏦 *Tienda del Banco — Personajes en venta*\n\n";
  const mentions = [];

  tienda.forEach((p, i) => {
    const h1 = p.habilidades?.[0]?.nombre || "-";
    const h2 = p.habilidades?.[1]?.nombre || "-";
    const deNumero = p.decomisadoDe?.numero ? String(p.decomisadoDe.numero) : null;
    const deTag = deNumero ? `${deNumero}@s.whatsapp.net` : null;
    if (deTag) mentions.push(deTag);

    texto +=
      `*${i + 1}.* ${p.nombre}\n` +
      `   • Nivel: ${p.nivel}\n` +
      `   • Habilidades: ${h1} | ${h2}\n` +
      `   • Precio venta: ${p.precio_venta} créditos\n` +
      (p.precio_original != null
        ? `   • Precio original: ${p.precio_original} créditos\n`
        : "") +
      (p.origen ? `   • Origen: ${p.origen}` : "") + "\n" +
      (deTag ? `   • Embargado a: @${deNumero}\n` : "") +
      `────────────────────\n`;
  });

  texto +=
    "\n🛒 *Cómo comprar:*\n" +
    "• *.comprarbank <número>*  (ej: *.comprarbank 1*)\n" +
    "• *.comprarbank <nombre>*  (ignora emojis/espacios)\n";

  await conn.sendMessage(
    chatId,
    {
      image: { url: "https://cdn.russellxz.click/4ec1a962.jpeg" },
      caption: texto,
      mentions
    },
    { quoted: msg }
  );
};

handler.command = ["tiendabank"];
module.exports = handler;
