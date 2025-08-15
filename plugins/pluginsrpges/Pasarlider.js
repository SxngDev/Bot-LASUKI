// plugins/pasarlider.js
// Comando: .pasarlider @usuario
// Solo el líder actual puede usarlo para transferir el liderazgo a otro miembro del clan.

const fs = require("fs");
const path = require("path");

function loadDB(p) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {}; }
function saveDB(p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 2)); }

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = (sender || "").replace(/\D/g, "");

  // Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "✨", key: msg.key } });

  // Obtener número del nuevo líder
  let nuevoNumero = args[0]?.replace(/\D/g, "");
  if (!nuevoNumero && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    nuevoNumero = msg.message.extendedTextMessage.contextInfo.mentionedJid[0].replace(/\D/g, "");
  }

  if (!nuevoNumero) {
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    return conn.sendMessage(chatId, { text: "⚠️ Uso: *.pasarlider @usuario*", quoted: msg });
  }

  const file = path.join(process.cwd(), "sukirpg.json");
  const db = loadDB(file);
  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
  db.clanes = Array.isArray(db.clanes) ? db.clanes : [];

  const user = db.usuarios.find(u => String(u.numero) === String(numero));
  if (!user) {
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    return conn.sendMessage(chatId, { text: "❌ No estás registrado en el RPG.", quoted: msg });
  }

  const clan = db.clanes.find(c => Array.isArray(c.miembros) && c.miembros.some(m => String(m.numero) === String(numero)));
  if (!clan) {
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    return conn.sendMessage(chatId, { text: "📭 No perteneces a ningún clan.", quoted: msg });
  }

  // Verificar si es el líder
  const esLider = clan.lider && clan.lider.numero && clan.lider.numero !== "BOT" && String(clan.lider.numero) === String(numero);
  if (!esLider) {
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    return conn.sendMessage(chatId, { text: "🚫 Solo el líder del clan puede transferir el liderazgo.", quoted: msg });
  }

  // Verificar que el nuevo líder esté en el mismo clan
  const nuevoMiembro = clan.miembros.find(m => String(m.numero) === String(nuevoNumero));
  const nuevoUser = db.usuarios.find(u => String(u.numero) === String(nuevoNumero));
  if (!nuevoMiembro || !nuevoUser) {
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    return conn.sendMessage(chatId, { text: "⚠️ El usuario indicado no es miembro de tu clan o no está registrado.", quoted: msg });
  }

  // Transferir liderazgo
  clan.lider = {
    numero: nuevoUser.numero,
    nombre: nuevoUser.nombre || "",
    apellido: nuevoUser.apellido || "",
    nivel: Number(nuevoUser.nivel || 1)
  };

  saveDB(file, db);

  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
  return conn.sendMessage(chatId, {
    text: `✅ Liderazgo transferido.\n👑 Nuevo líder: @${nuevoUser.numero}\n🏷️ Clan: *${clan.nombre}*`,
    mentions: [`${nuevoUser.numero}@s.whatsapp.net`],
    quoted: msg
  });
};

handler.command = ["pasarlider"];
module.exports = handler;
