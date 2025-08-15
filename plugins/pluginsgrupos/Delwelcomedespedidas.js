const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const isGroup = chatId.endsWith("@g.us");
  const senderId = msg.key.participant || msg.key.remoteJid;
  const isBot = msg.key.fromMe;

  // Verificar grupo
  if (!isGroup) {
    await conn.sendMessage(chatId, {
      text: "❌ Este comando solo puede usarse en grupos."
    }, { quoted: msg });
    return;
  }

  // Verificar si es admin
  let isAdmin = false;
  try {
    const metadata = await conn.groupMetadata(chatId);
    const participant = metadata.participants.find(p => p.id === senderId);
    isAdmin = participant?.admin === "admin" || participant?.admin === "superadmin";
  } catch {}

  if (!isAdmin && !isBot) {
    await conn.sendMessage(chatId, {
      text: "🚫 Solo administradores pueden eliminar los mensajes personalizados."
    }, { quoted: msg });
    return;
  }

  // Eliminar datos personalizados
  const welcomePath = path.resolve("setwelcome.json");
  if (!fs.existsSync(welcomePath)) {
    await conn.sendMessage(chatId, {
      text: "ℹ️ No hay mensajes personalizados configurados."
    }, { quoted: msg });
    return;
  }

  const data = JSON.parse(fs.readFileSync(welcomePath, "utf-8"));
  if (!data[chatId]) {
    await conn.sendMessage(chatId, {
      text: "ℹ️ Este grupo no tiene mensajes personalizados activos."
    }, { quoted: msg });
    return;
  }

  delete data[chatId].bienvenida;
  delete data[chatId].despedida;

  // Si el grupo ya no tiene datos, eliminar la entrada completa
  if (Object.keys(data[chatId]).length === 0) {
    delete data[chatId];
  }

  fs.writeFileSync(welcomePath, JSON.stringify(data, null, 2));

  await conn.sendMessage(chatId, {
    text: "🧹 Mensajes de bienvenida y despedida personalizados eliminados con éxito."
  }, { quoted: msg });
};

handler.command = ["delwelcome"];
module.exports = handler;
