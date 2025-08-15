// plugins/cocinar.js
const fs = require("fs");
const path = require("path");

const COOLDOWN_MS = 7 * 60 * 1000; // 7 min
const XP_NIVEL_BASE = 100;
const XP_HABILIDAD_BASE = 50;

// Recompensas base (puedes afinarlas)
const CREDITOS_MIN = 100, CREDITOS_MAX = 500;
const XP_MIN = 100, XP_MAX = 500;

// Topes diarios por usuario SOLO para este comando
const TOPE_CREDITOS_DIA = 8000;
const TOPE_XP_DIA = 10000;

const TEXTOS_COCINAR = [
  "🍳 {nombre} preparó un plato exquisito y ganó 💳 {creditos} créditos y ✨ {xp} XP.",
  "🥘 {nombre} cocinó a fuego lento y obtuvo 💳 {creditos} créditos y ✨ {xp} XP.",
  "🍜 {nombre} sorprendió con una receta secreta: +💳 {creditos} y +✨ {xp} XP.",
  "🥗 {nombre} equilibró sabores perfectos y consiguió 💳 {creditos} créditos y ✨ {xp} XP.",
  "🍖 {nombre} dominó la parrilla y ganó 💳 {creditos} créditos y ✨ {xp} XP.",
  "🧁 {nombre} horneó postres legendarios: +💳 {creditos} y +✨ {xp} XP.",
  "🍣 {nombre} armó sushi de nivel maestro y obtuvo 💳 {creditos} créditos y ✨ {xp} XP."
];

function hoyStrLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = (sender || "").replace(/\D/g, "");

  await conn.sendMessage(chatId, { react: { text: "🍳", key: msg.key } });

  const dbPath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf-8")) : {};
  db.usuarios = db.usuarios || [];

  const usuario = db.usuarios.find(u => u.numero === numero);
  if (!usuario) {
    return conn.sendMessage(chatId, { text: "❌ No estás registrado. Usa `.rpg nombre apellido edad fechaNacimiento` para registrarte." }, { quoted: msg });
  }

  // Cooldown
  const ahora = Date.now();
  if (usuario.ultimoCocinar && (ahora - usuario.ultimoCocinar) < COOLDOWN_MS) {
    const falta = Math.ceil((COOLDOWN_MS - (ahora - usuario.ultimoCocinar)) / 1000);
    const min = Math.floor(falta / 60), seg = falta % 60;
    return conn.sendMessage(chatId, { text: `⏳ Debes esperar *${min}m ${seg}s* para volver a cocinar.` }, { quoted: msg });
  }

  // Control diario
  const hoy = hoyStrLocal();
  if (!usuario.cocinarDiario || usuario.cocinarDiario.fecha !== hoy) {
    usuario.cocinarDiario = { fecha: hoy, creditos: 0, xp: 0 };
  }
  const restanteCred = Math.max(0, TOPE_CREDITOS_DIA - (usuario.cocinarDiario.creditos || 0));
  const restanteXP   = Math.max(0, TOPE_XP_DIA      - (usuario.cocinarDiario.xp || 0));
  if (restanteCred === 0 && restanteXP === 0) {
    return conn.sendMessage(chatId, { text: `🛑 Límite diario de *cocinar* alcanzado. Vuelve mañana. 😊` }, { quoted: msg });
  }

  // Recompensas
  const creditosBase = Math.floor(Math.random() * (CREDITOS_MAX - CREDITOS_MIN + 1)) + CREDITOS_MIN;
  const bonoNivel = (usuario.nivel || 1) * 50;
  const creditosGanados = creditosBase + bonoNivel;
  const xpGanada = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;

  const creditosOtorgados = Math.min(creditosGanados, restanteCred);
  const xpOtorgada = Math.min(xpGanada, restanteXP);
  if (creditosOtorgados === 0 && xpOtorgada === 0) {
    return conn.sendMessage(chatId, { text: `🛑 Ya alcanzaste el tope diario de *cocinar*.` }, { quoted: msg });
  }

  // Aplicar
  usuario.ultimoCocinar = ahora;
  usuario.creditos = (usuario.creditos || 0) + creditosOtorgados;
  usuario.xp = (usuario.xp || 0) + xpOtorgada;
  usuario.nivel = usuario.nivel || 1;

  usuario.cocinarDiario.creditos += creditosOtorgados;
  usuario.cocinarDiario.xp += xpOtorgada;

  // Subida de nivel usuario
  let subioNivel = false;
  let xpNeed = XP_NIVEL_BASE + (usuario.nivel * 20);
  while (usuario.xp >= xpNeed) {
    usuario.xp -= xpNeed;
    usuario.nivel++;
    subioNivel = true;
    xpNeed = XP_NIVEL_BASE + (usuario.nivel * 20);
  }

  // Habilidades (2 mín) + subir 1 aleatoria
  usuario.habilidades = Array.isArray(usuario.habilidades) && usuario.habilidades.length >= 2
    ? usuario.habilidades
    : [{ nombre: "Habilidad 1", nivel: 1, xp: 0 }, { nombre: "Habilidad 2", nivel: 1, xp: 0 }];

  const idxHab = Math.random() < 0.5 ? 0 : 1;
  const hab = usuario.habilidades[idxHab];
  hab.nivel = hab.nivel || 1;
  hab.xp = (hab.xp || 0) + xpOtorgada;

  let habSubida = null;
  if (hab.nivel < 100) {
    let xpHabNeed = XP_HABILIDAD_BASE + (hab.nivel * 10);
    while (hab.xp >= xpHabNeed && hab.nivel < 100) {
      hab.xp -= xpHabNeed; hab.nivel++; habSubida = `${hab.nombre} (Nv ${hab.nivel})`;
      xpHabNeed = XP_HABILIDAD_BASE + (hab.nivel * 10);
    }
  }

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

  // Mensaje
  const base = TEXTOS_COCINAR[Math.floor(Math.random() * TEXTOS_COCINAR.length)]
    .replace("{nombre}", `${usuario.nombre} ${usuario.apellido}`.trim())
    .replace("{creditos}", creditosOtorgados)
    .replace("{xp}", xpOtorgada);

  let out = base;
  if (subioNivel) out += `\n\n🎉 *¡Has subido al nivel ${usuario.nivel}!*`;
  if (habSubida) out += `\n✨ *Habilidad mejorada:* ${habSubida}`;

  await conn.sendMessage(chatId, { text: out }, { quoted: msg });
  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["cocinar"];
module.exports = handler;
