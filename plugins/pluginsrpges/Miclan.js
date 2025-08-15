// plugins/miclan.js
// Comando: .miclan / .vermiclan
// Muestra detalles del clan al que pertenece el usuario y SIEMPRE responde citando el mensaje.

const fs = require("fs");
const path = require("path");

function loadDB(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
}
function num(n) {
  return Number(n || 0).toLocaleString("es-ES", { maximumFractionDigits: 0 });
}
function fmtFecha(ts) {
  try {
    return new Date(Number(ts || Date.now())).toLocaleString("es-ES");
  } catch {
    return "—";
  }
}

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = (sender || "").replace(/\D/g, "");

  // Helpers que SIEMPRE citan el mensaje
  const replyQ = (content) => conn.sendMessage(chatId, content, { quoted: msg });

  // Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "📘", key: msg.key } });

  const file = path.join(process.cwd(), "sukirpg.json");
  const db = loadDB(file);
  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
  db.clanes   = Array.isArray(db.clanes)   ? db.clanes   : [];

  const user = db.usuarios.find(u => String(u.numero) === String(numero));
  if (!user) {
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    return replyQ({ text: "❌ No estás registrado en el RPG." });
  }

  // Buscar clan al que pertenece
  const clan = db.clanes.find(c => Array.isArray(c.miembros) && c.miembros.some(m => String(m.numero) === String(numero)));
  if (!clan) {
    await conn.sendMessage(chatId, { react: { text: "ℹ️", key: msg.key } });
    return replyQ({ text: "📭 No perteneces a ningún clan." });
  }

  // Preparar datos del clan
  const miembros = Array.isArray(clan.miembros) ? clan.miembros : [];
  const usuariosIndex = new Map(db.usuarios.map(u => [String(u.numero), u]));

  const liderStr = clan.lider
    ? (clan.lider.numero === "BOT"
        ? "La Suki Bot"
        : `@${clan.lider.numero}`)
    : "—";

  // Construir listado de miembros detallado
  const mentions = new Set();
  const lineas = [];

  let i = 1;
  for (const m of miembros) {
    const n = String(m.numero);
    const u = usuariosIndex.get(n) || {};
    const nombre = [u.nombre, u.apellido].filter(Boolean).join(" ") || "(sin nombre)";
    const nivel  = Number(u.nivel || 1);
    const edad   = (u.edad !== undefined && u.edad !== null) ? String(u.edad) : "—";
    const rol    = (clan.lider && clan.lider.numero && String(clan.lider.numero) === n) ? "líder" : (m.rol || "miembro");

    mentions.add(`${n}@s.whatsapp.net`);

    lineas.push(
      `${i}. @${n}\n` +
      `   👤 ${nombre}\n` +
      `   🎚️ Nivel: ${num(nivel)}  |  🎂 Edad: ${edad}\n` +
      `   🏷️ Rol: ${rol}`
    );
    i++;
  }

  // Cabecera
  const caption =
    `🏰 *Tu Clan*\n` +
    `🏷️ Nombre: *${clan.nombre}*\n` +
    `🗓️ Creado: ${fmtFecha(clan.creadoEn)}\n` +
    `👑 Líder: ${liderStr}\n` +
    `🎚️ Nivel del clan: *${num(clan.nivelClan || 1)}*\n` +
    `🧰 Bodega: *${num(clan.bodegaCreditos || 0)}* créditos\n` +
    `🎯 Nivel mínimo para unirse: *${num(clan.minNivelParaUnirse || 1)}*\n` +
    `👥 Miembros: *${miembros.length}*\n` +
    `────────────────\n` +
    `${lineas.join("\n")}`;

  // Menciones
  if (clan.lider && clan.lider.numero && clan.lider.numero !== "BOT") {
    mentions.add(`${clan.lider.numero}@s.whatsapp.net`);
  }
  mentions.add(`${numero}@s.whatsapp.net`);

  // Enviar con imagen si hay bannerUrl; SIEMPRE citando el mensaje original (quoted en 3er arg)
  if (clan.bannerUrl) {
    try {
      await conn.sendMessage(
        chatId,
        { image: { url: clan.bannerUrl }, caption, mentions: Array.from(mentions) },
        { quoted: msg }
      );
    } catch {
      await replyQ({ text: caption, mentions: Array.from(mentions) });
    }
  } else {
    await replyQ({ text: caption, mentions: Array.from(mentions) });
  }

  // Reacción final
  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["miclan", "vermiclan"];
module.exports = handler;
