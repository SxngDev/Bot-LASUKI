const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  if (!chatId.endsWith("@g.us")) {
    await conn.sendMessage(chatId, {
      text: "❌ *Este comando solo se puede usar en grupos.*"
    }, { quoted: msg });
    return;
  }

  try {
    const metadata = await conn.groupMetadata(chatId);
    const groupName = metadata.subject;
    const groupDesc = metadata.desc || "Sin descripción.";
    const ownerJid = metadata.owner || metadata.participants.find(p => p.admin === "superadmin")?.id;
    const creationTime = metadata.creation * 1000;
    const creationDate = new Date(creationTime).toLocaleString("es-ES", { timeZone: "America/Argentina/Buenos_Aires" });

    const groupOwner = ownerJid ? `@${ownerJid.split("@")[0]}` : "Desconocido";

    const info = `📌 *Información del Grupo*\n\n` +
                 `📍 *Nombre:* ${groupName}\n` +
                 `👑 *Creador:* ${groupOwner}\n` +
                 `📅 *Creado:* ${creationDate}\n` +
                 `📝 *Descripción:*\n${groupDesc}`;

    await conn.sendMessage(chatId, {
      text: info,
      mentions: [ownerJid]
    }, { quoted: msg });

  } catch (e) {
    console.error("❌ Error al obtener info del grupo:", e);
    await conn.sendMessage(chatId, {
      text: "❌ *Ocurrió un error al obtener la información del grupo.*"
    }, { quoted: msg });
  }
};

handler.command = ["infogrupo", "grupoinfo", "infogp"];
module.exports = handler;
