const fs = require("fs");
const path = require("path");

const RUTA = "./guar.json";

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = (msg.key.participant || msg.key.remoteJid).replace(/\D/g, "");
  const isGroup = chatId.endsWith("@g.us");

  await conn.sendMessage(chatId, { react: { text: "🗑️", key: msg.key } });

  const paquete = args[0]?.toLowerCase();
  const index = parseInt(args[1]);

  if (!paquete || isNaN(index)) {
    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
    return conn.sendMessage(chatId, {
      text: `❗ Usa correctamente:\n.del <paquete> <número>\nEj: .del hola 2`,
    }, { quoted: msg });
  }

  const db = JSON.parse(fs.readFileSync(RUTA));
  if (!db[paquete] || !db[paquete][index - 1]) {
    return conn.sendMessage(chatId, {
      text: `⚠️ No existe el paquete o el número es inválido.`,
    }, { quoted: msg });
  }

  const target = db[paquete][index - 1];
  const targetUser = target.de;

  // 🛡️ Protección de permisos
  let isAdmin = false;
  if (isGroup) {
    const metadata = await conn.groupMetadata(chatId);
    const me = (conn.user.id || "").split(":")[0] + "@s.whatsapp.net";
    const participants = metadata.participants || [];
    const user = participants.find(p => p.id === sender + "@s.whatsapp.net");
    const bot = participants.find(p => p.id === me);
    isAdmin = user?.admin && bot?.admin;
  }

  const esOwner = global.isOwner(sender);
  const esDueñoDelArchivo = targetUser === sender;
  const archivoEsDeOwner = global.owner.some(([o]) => o === targetUser);

  if (!esOwner && !esDueñoDelArchivo && (!isAdmin || archivoEsDeOwner)) {
    return conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    }).then(() => conn.sendMessage(chatId, {
      text: `🚫 No tienes permiso para eliminar ese archivo.`,
    }, { quoted: msg }));
  }

  db[paquete].splice(index - 1, 1);
  if (db[paquete].length === 0) delete db[paquete];
  fs.writeFileSync(RUTA, JSON.stringify(db, null, 2));

  await conn.sendMessage(chatId, {
    react: { text: "✅", key: msg.key }
  });

  return conn.sendMessage(chatId, {
    text: `✅ Archivo número ${index} eliminado del paquete: *${paquete}*`
  }, { quoted: msg });
};

handler.command = ["del"];
module.exports = handler;
