// plugins/superpoder.js
const fs = require("fs");
const path = require("path");

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 horas
const NIVEL_MINIMO = 20;

const XP_PERSONAJE_BASE = 150;
const XP_HAB_BASE = 80;

const CREDITOS_MIN = 1000;
const CREDITOS_MAX = 2000;
const XP_MIN = 1000;
const XP_MAX = 5000;

const TEXTOS_SUPERPODER = [
  "🌟 {nombre} desató su *SUPERPODER* con *{personaje}* y obtuvo 💳 {creditos} créditos y ✨ {xp} XP.",
  "⚡ {nombre} activó un aura imparable con *{personaje}* y ganó 💳 {creditos} créditos y ✨ {xp} XP.",
  "🔥 {nombre} liberó energía suprema junto a *{personaje}*: 💳 {creditos} créditos y ✨ {xp} XP.",
  "🌌 {nombre} dominó fuerzas místicas con *{personaje}* y recibió 💳 {creditos} créditos y ✨ {xp} XP.",
  "💥 {nombre} ejecutó una técnica final con *{personaje}* y consiguió 💳 {creditos} créditos y ✨ {xp} XP.",
  "🛡️ {nombre} ascendió el poder de *{personaje}* y obtuvo 💳 {creditos} créditos y ✨ {xp} XP.",
  "🌀 {nombre} sobrecargó a *{personaje}* con poder puro: 💳 {creditos} créditos y ✨ {xp} XP."
];

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = (sender || "").replace(/\D/g, "");

  await conn.sendMessage(chatId, { react: { text: "🌟", key: msg.key } });

  // Cargar DB
  const filePath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath)) : {};
  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];

  const usuario = db.usuarios.find(u => u.numero === numero);
  if (!usuario) {
    return conn.sendMessage(
      chatId,
      { text: "❌ No estás registrado. Usa `.rpg nombre apellido edad fechaNacimiento` para registrarte." },
      { quoted: msg }
    );
  }

  // Nivel mínimo
  if ((usuario.nivel || 1) < NIVEL_MINIMO) {
    return conn.sendMessage(
      chatId,
      { text: `🚫 Necesitas ser al menos *nivel ${NIVEL_MINIMO}* para usar *superpoder*.` },
      { quoted: msg }
    );
  }

  // Requiere personaje
  if (!Array.isArray(usuario.personajes) || usuario.personajes.length === 0) {
    return conn.sendMessage(
      chatId,
      { text: "🎭 No tienes un personaje activo. Compra uno en la tienda." },
      { quoted: msg }
    );
  }

  // Cooldown
  const ahora = Date.now();
  if (usuario.ultimoSuperpoder && (ahora - usuario.ultimoSuperpoder) < COOLDOWN_MS) {
    const falta = Math.ceil((COOLDOWN_MS - (ahora - usuario.ultimoSuperpoder)) / 1000);
    const horas = Math.floor(falta / 3600);
    const min = Math.floor((falta % 3600) / 60);
    const seg = falta % 60;
    return conn.sendMessage(
      chatId,
      { text: `⏳ Debes esperar *${horas}h ${min}m ${seg}s* para volver a usar *superpoder*.` },
      { quoted: msg }
    );
  }
  usuario.ultimoSuperpoder = ahora;

  // Entidades
  const personaje = usuario.personajes[0];
  personaje.nivel = personaje.nivel || 1;
  personaje.xp = personaje.xp || 0;
  personaje.habilidades = Array.isArray(personaje.habilidades) && personaje.habilidades.length >= 2
    ? personaje.habilidades
    : [
        { nombre: "Habilidad 1", nivel: 1, xp: 0 },
        { nombre: "Habilidad 2", nivel: 1, xp: 0 }
      ];
  for (const h of personaje.habilidades) { h.nivel = h.nivel || 1; h.xp = h.xp || 0; }

  // Recompensas
  const creditosGanados = Math.floor(Math.random() * (CREDITOS_MAX - CREDITOS_MIN + 1)) + CREDITOS_MIN;
  const xpGanada = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;

  usuario.creditos = (usuario.creditos || 0) + creditosGanados;

  // XP al personaje + subir nivel si corresponde
  let subioNivelPersonaje = false;
  personaje.xp += xpGanada;
  let xpNecesaria = XP_PERSONAJE_BASE + (personaje.nivel * 25);
  while (personaje.xp >= xpNecesaria) {
    personaje.xp -= xpNecesaria;
    personaje.nivel += 1;
    subioNivelPersonaje = true;
    xpNecesaria = XP_PERSONAJE_BASE + (personaje.nivel * 25);
  }

  // Una sola habilidad aleatoria
  const idxHab = Math.random() < 0.5 ? 0 : 1;
  const hab = personaje.habilidades[idxHab];
  let habilidadSubida = null;
  if (hab.nivel < 100) {
    hab.xp += xpGanada;
    let xpNecesariaHab = XP_HAB_BASE + (hab.nivel * 12);
    while (hab.xp >= xpNecesariaHab && hab.nivel < 100) {
      hab.xp -= xpNecesariaHab;
      hab.nivel += 1;
      habilidadSubida = `${hab.nombre} (Nv ${hab.nivel})`;
      xpNecesariaHab = XP_HAB_BASE + (hab.nivel * 12);
    }
  }

  // Guardar
  fs.writeFileSync(filePath, JSON.stringify(db, null, 2));

  // Mensaje
  const base = TEXTOS_SUPERPODER[Math.floor(Math.random() * TEXTOS_SUPERPODER.length)]
    .replace("{nombre}", `${usuario.nombre} ${usuario.apellido}`.trim())
    .replace("{personaje}", personaje.nombre || "tu personaje")
    .replace("{creditos}", creditosGanados)
    .replace("{xp}", xpGanada);

  let mensajeFinal = base;
  if (subioNivelPersonaje) mensajeFinal += `\n\n🎉 *¡${personaje.nombre || "Tu personaje"} subió a nivel ${personaje.nivel}!*`;
  if (habilidadSubida) mensajeFinal += `\n\n✨ *Habilidad de personaje mejorada:* ${habilidadSubida}`;

  await conn.sendMessage(chatId, { text: mensajeFinal }, { quoted: msg });
  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["superpoder"];
module.exports = handler;
