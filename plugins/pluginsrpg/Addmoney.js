// plugins/addmoney.js
const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = (sender || "").replace(/[^0-9]/g, "");
  const fromMe = msg.key.fromMe;
  const botID = (conn.user?.id || "").replace(/[^0-9]/g, "");

  // 🏦 Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "💰", key: msg.key } });

  // 🔒 Permisos: solo owners o bot
  if (!global.isOwner(numero) && !fromMe && numero !== botID) {
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    return conn.sendMessage(chatId, {
      text: "🚫 Solo los owners o el mismo bot pueden usar este comando."
    }, { quoted: msg });
  }

  // 📌 Validar cantidad
  if (!args[0] || isNaN(args[0]) || parseInt(args[0]) <= 0) {
    return conn.sendMessage(chatId, {
      text: `✳️ *Uso correcto:*\n.addmoney <cantidad>\n\n📌 Ejemplo:\n• .addmoney 5000 (agrega 5000 créditos al banco)`,
      quoted: msg
    });
  }

  const cantidad = parseInt(args[0]);

  // 📂 Cargar base de datos
  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  if (!fs.existsSync(sukirpgPath)) {
    return conn.sendMessage(chatId, {
      text: "❌ No existe la base de datos del RPG.",
      quoted: msg
    });
  }

  const db = JSON.parse(fs.readFileSync(sukirpgPath, "utf-8"));

  if (!db.banco) {
    return conn.sendMessage(chatId, {
      text: "🏦 No hay un banco configurado. Usa `.addbank` primero.",
      quoted: msg
    });
  }

  // 💳 Sumar al capital actual
  db.banco.montoTotal = (Number(db.banco.montoTotal) || 0) + cantidad;

  fs.writeFileSync(sukirpgPath, JSON.stringify(db, null, 2));

  // ✅ Confirmación
  await conn.sendMessage(chatId, {
    text: `🏦 *Capital del Banco actualizado*\n\n💳 Capital anterior: ${(db.banco.montoTotal - cantidad)} créditos\n💰 Cantidad agregada: ${cantidad} créditos\n📈 Capital actual: ${db.banco.montoTotal} créditos`,
    quoted: msg
  });

  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["addmoney"];
module.exports = handler;
