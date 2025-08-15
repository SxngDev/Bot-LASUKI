const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const senderId = (msg.key.participant || msg.key.remoteJid).replace(/[^0-9]/g, "");

  if (!chatId.endsWith("@g.us")) {
    await conn.sendMessage(chatId, {
      text: "❌ *Este comando solo se puede usar en grupos.*"
    }, { quoted: msg });
    return;
  }

  const metadata = await conn.groupMetadata(chatId);
  const participante = metadata.participants.find(p => p.id.includes(senderId));
  const isAdmin = participante?.admin === "admin" || participante?.admin === "superadmin";

  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath) ? JSON.parse(fs.readFileSync(ownerPath)) : [];
  const isOwner = owners.some(([id]) => id === senderId);

  if (!isAdmin && !isOwner) {
    await conn.sendMessage(chatId, {
      text: "⛔ *Solo administradores o dueños del bot pueden usar este comando.*"
    }, { quoted: msg });
    return;
  }

  if (!msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
    await conn.sendMessage(chatId, {
      text: "❓ *Debes responder al mensaje que deseas eliminar con el comando `.delete`.*"
    }, { quoted: msg });
    return;
  }

  const { stanzaId, participant } = msg.message.extendedTextMessage.contextInfo;

  try {
    await conn.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        fromMe: false,
        id: stanzaId,
        participant: participant
      }
    });

    await conn.sendMessage(chatId, {
      text: `✅ *Mensaje eliminado exitosamente.*`,
      quoted: msg
    });

  } catch (e) {
    console.error("❌ Error al eliminar mensaje:", e);
    await conn.sendMessage(chatId, {
      text: "❌ *No se pudo eliminar el mensaje.*"
    }, { quoted: msg });
  }
};

handler.command = ["delete"];
module.exports = handler;
