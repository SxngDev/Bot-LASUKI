// plugins/crearclan.js
// Uso: .crearclan <Nombre del Clan> <nivelMinParaUnirse>
// Requiere: nivel de usuario ≥ 30 y costo 30,000 créditos.
// Crea clan nivel 1, con bodega y registra al líder.

const fs = require("fs");
const path = require("path");

const COSTO_CREAR_CLAN = 30000;

function loadDB(p) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {}; }
function saveDB(p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 2)); }

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender  = msg.key.participant || msg.key.remoteJid;
  const numero  = (sender || "").replace(/\D/g, "");

  await conn.sendMessage(chatId, { react: { text: "🏷️", key: msg.key } });

  if (!args?.length || args.length < 2) {
    return conn.sendMessage(chatId, {
      text: "✳️ Uso: *.crearclan <Nombre del Clan> <nivelMinParaUnirse>*\nEj: *.crearclan Super nova 20*",
      quoted: msg
    });
  }

  // nivelMin = último argumento; nombre = resto
  const maybeLevel = parseInt(args[args.length - 1], 10);
  const nivelMin = Number.isFinite(maybeLevel) ? maybeLevel : null;
  const nombre = (nivelMin === null ? args.join(" ") : args.slice(0, -1).join(" ")).trim();

  if (!nombre) {
    return conn.sendMessage(chatId, { text: "❌ Debes indicar el nombre del clan.", quoted: msg });
  }
  if (!Number.isFinite(nivelMin) || nivelMin < 1) {
    return conn.sendMessage(chatId, { text: "❌ Nivel mínimo para unirse inválido (usa un número ≥ 1).", quoted: msg });
  }

  const file = path.join(process.cwd(), "sukirpg.json");
  const db = loadDB(file);

  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
  db.clanes   = Array.isArray(db.clanes)   ? db.clanes   : [];

  const lider = db.usuarios.find(u => String(u.numero) === String(numero));
  if (!lider) {
    return conn.sendMessage(chatId, { text: "❌ No estás registrado en el RPG.", quoted: msg });
  }

  // Requisito: nivel ≥ 30
  const nivelUsuario = Number(lider.nivel || 1);
  if (nivelUsuario < 30) {
    return conn.sendMessage(chatId, {
      text: `🚫 Debes ser *nivel 30* o más para crear un clan. Tu nivel actual: *${nivelUsuario}*.`,
      quoted: msg
    });
  }

  // Requisito: costo 30,000
  const saldo = Number(lider.creditos || 0);
  if (saldo < COSTO_CREAR_CLAN) {
    return conn.sendMessage(chatId, {
      text: `❌ Créditos insuficientes. Crear un clan cuesta *${COSTO_CREAR_CLAN.toLocaleString("es-ES")}* créditos.\nTu saldo: *${saldo.toLocaleString("es-ES")}*`,
      quoted: msg
    });
  }

  // ¿ya está en un clan?
  const yaEnClan = db.clanes.find(c => c.miembros?.some(m => String(m.numero) === String(numero)));
  if (yaEnClan) {
    return conn.sendMessage(chatId, { text: "🚫 Ya perteneces a un clan. Debes salir antes de crear otro.", quoted: msg });
  }

  // ¿nombre ya existe?
  const existeNombre = db.clanes.find(c => c.nombre?.toLowerCase() === nombre.toLowerCase());
  if (existeNombre) {
    return conn.sendMessage(chatId, { text: "🚫 Ya existe un clan con ese nombre. Elige otro.", quoted: msg });
  }

  // Cobrar
  lider.creditos = saldo - COSTO_CREAR_CLAN;

  const ahora = Date.now();

  const clan = {
    id: `CLAN_${ahora}_${Math.floor(Math.random()*9999)}`,
    nombre,
    esSupremo: false,
    bannerUrl: null, // solo el clan supremo guarda banner
    creadoEn: ahora,
    nivelClan: 1,
    minNivelParaUnirse: nivelMin,
    bodegaCreditos: 0,
    lider: {
      numero: lider.numero,
      nombre: lider.nombre || "",
      apellido: lider.apellido || "",
      nivel: nivelUsuario
    },
    origenChat: chatId,
    miembros: [
      { numero: lider.numero, rol: "lider", desde: ahora }
    ]
  };

  db.clanes.push(clan);
  saveDB(file, db);

  await conn.sendMessage(chatId, {
    text:
`✅ *Clan creado*
🏷️ Nombre: *${clan.nombre}*
👑 Líder: @${lider.numero}
🎚️ Nivel del clan: 1
🧰 Bodega: 0 créditos
🎯 Nivel mínimo para unirse: *${nivelMin}*
💳 Coste: -${COSTO_CREAR_CLAN.toLocaleString("es-ES")} créditos
💼 Tu saldo ahora: *${lider.creditos.toLocaleString("es-ES")}*
🗓️ Creado: ${new Date(ahora).toLocaleString()}`,
    mentions: [`${lider.numero}@s.whatsapp.net`],
    quoted: msg
  });

  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["crearclan"];
module.exports = handler;
