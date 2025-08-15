// plugins/robar.js
// Robar créditos (solo saldo "afuera") y XP a otro usuario.
// 15% de fallo: el ladrón paga créditos a la víctima.
// Cooldown: 7 min. Topes diarios (para el ladrón): 8,000 créditos / 10,000 XP.
// Al acertar: sube nivel del usuario y 1 habilidad del ladrón (misma lógica que minar).

const fs = require("fs");
const path = require("path");

const COOLDOWN_MS = 7 * 60 * 1000;
const TOPE_CREDITOS_DIA = 8000;
const TOPE_XP_DIA = 10000;

const XP_NIVEL_BASE = 100;
const XP_HABILIDAD_BASE = 50;

const FAIL_PROB = 0.15;   // 15% de fallo

// Botín cuando SALE BIEN
const CRED_MIN = 120, CRED_MAX = 480;
const XP_MIN   = 160, XP_MAX   = 420;

// Penalización cuando SALE MAL (solo créditos)
const PENAL_MIN = 150, PENAL_MAX = 500;

const TEXTOS_EXITO = [
  "🕶️ {ladron} se deslizó entre las sombras y robó 💳 {creditos} créditos y ✨ {xp} XP a {victima}.",
  "🕶️ {ladron} distrajo a {victima} con un truco y obtuvo 💳 {creditos} créditos y ✨ {xp} XP.",
  "🕶️ {ladron} hizo un golpe limpio: 💳 {creditos} créditos y ✨ {xp} XP arrebatados a {victima}.",
  "🕶️ {ladron} aprovechó el caos y se llevó 💳 {creditos} créditos y ✨ {xp} XP de {victima}.",
  "🕶️ {ladron} vació bolsillos ajenos: +💳 {creditos} y +✨ {xp} XP (de {victima}).",
  "🕶️ {ladron} aplicó sigilo total y robó 💳 {creditos} créditos y ✨ {xp} XP a {victima}.",
  "🕶️ {ladron} ejecutó el plan perfecto: 💳 {creditos} y ✨ {xp} XP ahora son suyos (adiós, {victima})."
];

const TEXTOS_FALLO = [
  "🚨 {ladron} fue descubierto por {victima} y terminó pagando 💳 {pago} créditos.",
  "🚨 {ladron} tropezó y {victima} lo hizo pagar 💳 {pago} créditos.",
  "🚨 {ladron} subestimó a {victima}: multa inmediata de 💳 {pago} créditos.",
  "🚨 {ladron} falló el golpe y perdió 💳 {pago} créditos a favor de {victima}.",
  "🚨 {ladron} quedó en evidencia. {victima} le quitó 💳 {pago} créditos.",
  "🚨 {ladron} no calculó bien: paga 💳 {pago} créditos a {victima}.",
  "🚨 {ladron} fue delatado. Compensa con 💳 {pago} créditos a {victima}."
];

const toNum = (jid) => String(jid || "").replace(/\D/g, "");
const rng = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

function hoyStrLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const thiefJid = msg.key.participant || msg.key.remoteJid;
  const thiefNum = toNum(thiefJid);

  await conn.sendMessage(chatId, { react: { text: "🕶️", key: msg.key } });

  // Detectar objetivo por cita o mención
  let targetJid = null;
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (ctx?.quotedMessage) targetJid = ctx.participant;
  if (!targetJid && ctx?.mentionedJid?.length) targetJid = ctx.mentionedJid[0];

  if (!targetJid) {
    return conn.sendMessage(chatId, {
      text: "🕶️ *Robo fallido:* menciona o responde a un usuario para intentar robarle.",
    }, { quoted: msg });
  }

  const targetNum = toNum(targetJid);
  if (!targetNum || targetNum === thiefNum) {
    return conn.sendMessage(chatId, { text: "🚫 No puedes robarte a ti mismo." }, { quoted: msg });
  }

  // Cargar DB
  const filePath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : {};
  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];

  const thief = db.usuarios.find(u => u.numero === thiefNum);
  const victim = db.usuarios.find(u => u.numero === targetNum);

  if (!thief) {
    return conn.sendMessage(chatId, {
      text: "❌ No estás registrado. Usa `.rpg nombre apellido edad fechaNacimiento` para registrarte.",
    }, { quoted: msg });
  }
  if (!victim) {
    return conn.sendMessage(chatId, { text: "❌ El objetivo no está registrado en el RPG." }, { quoted: msg });
  }

  // Cooldown SOLO para el ladrón
  thief.cooldowns = thief.cooldowns || {};
  if (thief.cooldowns.robar && (Date.now() - thief.cooldowns.robar) < COOLDOWN_MS) {
    const falta = Math.ceil((COOLDOWN_MS - (Date.now() - thief.cooldowns.robar)) / 1000);
    const min = Math.floor(falta / 60), seg = falta % 60;
    return conn.sendMessage(chatId, {
      text: `⏳ Debes esperar *${min}m ${seg}s* para volver a robar.`,
    }, { quoted: msg });
  }

  // Normalizar campos
  const ahora = Date.now();
  thief.creditos = Number(thief.creditos || 0);
  thief.guardado = Number(thief.guardado || 0);
  thief.xp = Number(thief.xp || 0);
  thief.nivel = Number(thief.nivel || 1);

  victim.creditos = Number(victim.creditos || 0);
  victim.xp = Number(victim.xp || 0);

  // Control diario SOLO del ladrón (como minar)
  const hoy = hoyStrLocal();
  if (!thief.robarDiario || thief.robarDiario.fecha !== hoy) {
    thief.robarDiario = { fecha: hoy, creditos: 0, xp: 0 };
  }
  const restanteCred = Math.max(0, TOPE_CREDITOS_DIA - (thief.robarDiario.creditos || 0));
  const restanteXP   = Math.max(0, TOPE_XP_DIA      - (thief.robarDiario.xp || 0));

  const thiefTag = `${thiefNum}@s.whatsapp.net`;
  const victimTag = `${targetNum}@s.whatsapp.net`;

  // ¿Sale mal?
  const fallo = Math.random() < FAIL_PROB;
  if (fallo) {
    // Penalización: el ladrón paga créditos a la víctima (no toca guardado)
    const penal = rng(PENAL_MIN, PENAL_MAX);
    const pago = Math.min(penal, thief.creditos);
    thief.creditos -= pago;
    victim.creditos += pago;

    // Consumimos cooldown SIEMPRE en fallo
    thief.cooldowns.robar = ahora;
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2));

    const t = TEXTOS_FALLO[Math.floor(Math.random() * TEXTOS_FALLO.length)]
      .replace("{ladron}", `@${thiefNum}`)
      .replace("{victima}", `@${targetNum}`)
      .replace("{pago}", `${pago}`);

    await conn.sendMessage(chatId, { text: t, mentions: [thiefTag, victimTag] }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    return;
  }

  // Éxito: calcular botín deseado
  const credDeseado = rng(CRED_MIN, CRED_MAX);
  const xpDeseada   = rng(XP_MIN, XP_MAX);

  // Limitar por lo que la víctima tiene y por tope del ladrón
  const credPosibleVictima = Math.max(0, victim.creditos);
  const xpPosibleVictima   = Math.max(0, victim.xp);

  let credOtorgados = Math.min(credDeseado, credPosibleVictima, restanteCred);
  let xpOtorgada    = Math.min(xpDeseada,   xpPosibleVictima,   restanteXP);

  // Si no hay nada que otorgar por topes o por falta de recursos, avisar y NO consumir cooldown
  if (credOtorgados <= 0 && xpOtorgada <= 0) {
    return conn.sendMessage(chatId, {
      text: "🛑 No puedes obtener más hoy con *robar* o la víctima no tiene nada para robar ahora.",
    }, { quoted: msg });
  }

  // Transferir SOLO lo que el ladrón puede recibir (capped)
  if (credOtorgados > 0) {
    victim.creditos -= credOtorgados;
    thief.creditos  += credOtorgados;
  }
  if (xpOtorgada > 0) {
    victim.xp -= xpOtorgada;
    thief.xp  += xpOtorgada;
  }

  // Consumir cooldown
  thief.cooldowns.robar = ahora;

  // Actualizar acumulados del día (del ladrón)
  thief.robarDiario.creditos += credOtorgados;
  thief.robarDiario.xp += xpOtorgada;

  // Subida de nivel (usuario ladrón) con la XP robada
  let subioNivelUsuario = false;
  let xpNecesarioUsuario = XP_NIVEL_BASE + (thief.nivel * 20);
  while (thief.xp >= xpNecesarioUsuario) {
    thief.xp -= xpNecesarioUsuario;
    thief.nivel += 1;
    subioNivelUsuario = true;
    xpNecesarioUsuario = XP_NIVEL_BASE + (thief.nivel * 20);
  }

  // Asegurar 2 habilidades en el ladrón y subir UNA aleatoria
  thief.habilidades = Array.isArray(thief.habilidades) && thief.habilidades.length >= 2
    ? thief.habilidades
    : [
        { nombre: "Habilidad 1", nivel: 1, xp: 0 },
        { nombre: "Habilidad 2", nivel: 1, xp: 0 }
      ];
  const idxHab = Math.random() < 0.5 ? 0 : 1;
  const hab = thief.habilidades[idxHab];
  hab.nivel = hab.nivel || 1;
  hab.xp = (hab.xp || 0) + xpOtorgada;

  let habilidadSubida = null;
  if (hab.nivel < 100) {
    let xpNecesariaHab = XP_HABILIDAD_BASE + (hab.nivel * 10);
    while (hab.xp >= xpNecesariaHab && hab.nivel < 100) {
      hab.xp -= xpNecesariaHab;
      hab.nivel += 1;
      habilidadSubida = `${hab.nombre} (Nv ${hab.nivel})`;
      xpNecesariaHab = XP_HABILIDAD_BASE + (hab.nivel * 10);
    }
  }

  // Guardar DB
  fs.writeFileSync(filePath, JSON.stringify(db, null, 2));

  // Mensaje final (como minar: base + subidas)
  const base = TEXTOS_EXITO[Math.floor(Math.random() * TEXTOS_EXITO.length)]
    .replace("{ladron}", `@${thiefNum}`)
    .replace("{victima}", `@${targetNum}`)
    .replace("{creditos}", `${credOtorgados}`)
    .replace("{xp}", `${xpOtorgada}`);

  let mensajeFinal = base;
  if (subioNivelUsuario) {
    mensajeFinal += `\n\n🎉 *¡Has subido al nivel ${thief.nivel}!*`;
  }
  if (habilidadSubida) {
    mensajeFinal += `\n✨ *Habilidad mejorada:* ${habilidadSubida}`;
  }

  await conn.sendMessage(chatId, { text: mensajeFinal, mentions: [thiefTag, victimTag] }, { quoted: msg });
  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["robar"];
module.exports = handler;
