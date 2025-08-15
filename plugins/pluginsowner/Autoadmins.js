const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const senderId = msg.key.participant || msg.key.remoteJid;
  const senderNum = senderId.replace(/[^0-9]/g, "");
  const isGroup = chatId.endsWith("@g.us");
  const isOwner = global.owner.some(([id]) => id === senderNum);

  // ⏱️ Reacción inmediata
  await conn.sendMessage(chatId, {
    react: { text: "⚙️", key: msg.key }
  });

  if (!isGroup) {
    return conn.sendMessage(chatId, {
      text: "❌ Este comando solo se puede usar en grupos."
    }, { quoted: msg });
  }

  if (!isOwner) {
    return conn.sendMessage(chatId, {
      text: "⛔ Solo el *dueño del bot* puede usar este comando."
    }, { quoted: msg });
  }

  const metadata = await conn.groupMetadata(chatId);
  const participants = metadata.participants;

  // ✅ Arreglado: ID limpio del bot
  const rawBotId = conn.user.id;
  const botJid = rawBotId.includes(":")
    ? `${rawBotId.split(":")[0]}@s.whatsapp.net`
    : rawBotId;
  const ownerJid = `${senderNum}@s.whatsapp.net`;

  const botData = participants.find(p => p.id === botJid);
  const ownerData = participants.find(p => p.id === ownerJid);

  const botIsAdmin = botData?.admin === "admin" || botData?.admin === "superadmin";
  const ownerIsAdmin = ownerData?.admin === "admin" || ownerData?.admin === "superadmin";

  if (!botIsAdmin) {
    return conn.sendMessage(chatId, {
      text: "⚠️ *El bot no tiene permisos de administrador en este grupo.*"
    }, { quoted: msg });
  }

  if (ownerIsAdmin) {
    return conn.sendMessage(chatId, {
      text: "✅ *Ya eres administrador del grupo.*"
    }, { quoted: msg });
  }

  try {
    await conn.groupParticipantsUpdate(chatId, [ownerJid], "promote");

    await conn.sendMessage(chatId, {
      react: { text: "👑", key: msg.key }
    });

    await conn.sendMessage(chatId, {
      text: `👑 *Has reclamado tu trono, mi dueño, mi rey.*\nAhora eres *administrador* del grupo.`,
      mentions: [ownerJid]
    }, { quoted: msg });
  } catch (e) {
    console.error("❌ Error al promover al owner:", e);
    await conn.sendMessage(chatId, {
      text: "❌ No se pudo otorgar admin. Verifica si el bot tiene permisos suficientes."
    }, { quoted: msg });
  }
};

handler.command = ["autoadmins"];
module.exports = handler;
