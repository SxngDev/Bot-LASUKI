const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args, participants }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = sender.replace(/\D/g, "");
  const isFromMe = msg.key.fromMe;
  const botID = (conn.user?.id || "").replace(/\D/g, "");

  await conn.sendMessage(chatId, { react: { text: "🎁", key: msg.key } });

  // Solo owners
  if (!global.isOwner(numero) && !isFromMe && numero !== botID) {
    return conn.sendMessage(chatId, {
      text: "🚫 Solo los *owners* pueden usar este comando.",
      quoted: msg
    });
  }

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath)) : {};
  if (!db.usuarios) db.usuarios = [];

  // Sacar el número del usuario objetivo
  let target = null;
  let cantidad = null;

  // 🧠 Si el mensaje es respuesta a otro mensaje
  if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
    target = msg.message.extendedTextMessage.contextInfo.participant.replace(/\D/g, "");
    cantidad = parseInt(args[0]);
  }

  // 🧠 Si se mencionó un número directamente
  if (!target && args[0]?.match(/\d{5,}/)) {
    target = args[0].replace(/\D/g, "");
    cantidad = parseInt(args[1]);
  }

  // 🧠 Si se mencionó a alguien con @
  if (!target && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0].replace(/\D/g, "");
    cantidad = parseInt(args[0]);
  }

  // Si todavía no hay target
  if (!target || isNaN(cantidad) || cantidad <= 0) {
    return conn.sendMessage(chatId, {
      text: `✳️ *Uso correcto:*\n.dar número/cita menc cantidad\n📌 Ej:\n• .dar 549xxxxxxxx 100\n• responde a un mensaje con .dar 100`,
      quoted: msg
    });
  }

  // Buscar usuario y validar registro
  const user = db.usuarios.find(u => u.numero === target);
  if (!user) {
    return conn.sendMessage(chatId, {
      text: `❌ El usuario @${target} no está registrado en el RPG.`,
      mentions: [`${target}@s.whatsapp.net`],
      quoted: msg
    });
  }

  // Sumarle créditos
  user.creditos += cantidad;
  fs.writeFileSync(sukirpgPath, JSON.stringify(db, null, 2));

  // Confirmación
  await conn.sendMessage(chatId, {
    text: `✅ Se le han dado *${cantidad} créditos 💳* a @${target} correctamente.`,
    mentions: [`${target}@s.whatsapp.net`],
    quoted: msg
  });

  await conn.sendMessage(chatId, {
    react: { text: "✅", key: msg.key }
  });
};

handler.command = ["dar"];
module.exports = handler;
