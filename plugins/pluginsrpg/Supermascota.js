// plugins/supermascota.js
const fs = require("fs");
const path = require("path");

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 horas
const NIVEL_MINIMO = 20;

const XP_MASCOTA_BASE = 150;
const XP_HAB_BASE = 80;

const CREDITOS_MIN = 500;
const CREDITOS_MAX = 2000;
const XP_MIN = 1000;
const XP_MAX = 5000;

const TEXTOS_SUPERMASCOTA = [
  "🐲 {nombre} entrenó intensamente con *{mascota}* y ganó 💳 {creditos} créditos y ✨ {xp} XP.",
  "🦄 {nombre} llevó a *{mascota}* a una misión épica y obtuvo 💳 {creditos} créditos y ✨ {xp} XP.",
  "🦅 {nombre} surcó los cielos con *{mascota}* y recibió 💳 {creditos} créditos y ✨ {xp} XP.",
  "🦁 {nombre} desafió a bestias junto a *{mascota}* y consiguió 💳 {creditos} créditos y ✨ {xp} XP.",
  "🐉 {nombre} exploró tierras lejanas con *{mascota}* y ganó 💳 {creditos} créditos y ✨ {xp} XP.",
  "🦊 {nombre} hizo una expedición legendaria con *{mascota}* y obtuvo 💳 {creditos} créditos y ✨ {xp} XP.",
  "🦅 {nombre} participó en la batalla final con *{mascota}* y recibió 💳 {creditos} créditos y ✨ {xp} XP."
];

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = (sender || "").replace(/\D/g, "");

  await conn.sendMessage(chatId, { react: { text: "🐲", key: msg.key } });

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath)) : {};
  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];

  const usuario = db.usuarios.find(u => u.numero === numero);
  if (!usuario) {
    return conn.sendMessage(chatId, { text: "❌ No estás registrado. Usa `.rpg nombre apellido edad fechaNacimiento` para registrarte." }, { quoted: msg });
  }

  if ((usuario.nivel || 1) < NIVEL_MINIMO) {
    return conn.sendMessage(chatId, { text: `🚫 Necesitas ser al menos *nivel ${NIVEL_MINIMO}* para usar este comando.` }, { quoted: msg });
  }

  if (!Array.isArray(usuario.mascotas) || usuario.mascotas.length === 0) {
    return conn.sendMessage(chatId, { text: "🐾 No tienes una mascota aún. Compra una en la tienda para poder usar este comando." }, { quoted: msg });
  }

  const ahora = Date.now();
  if (usuario.ultimoSuperMascota && (ahora - usuario.ultimoSuperMascota) < COOLDOWN_MS) {
    const falta = Math.ceil((COOLDOWN_MS - (ahora - usuario.ultimoSuperMascota)) / 1000);
    const horas = Math.floor(falta / 3600);
    const min = Math.floor((falta % 3600) / 60);
    const seg = falta % 60;
    return conn.sendMessage(chatId, { text: `⏳ Debes esperar *${horas}h ${min}m ${seg}s* para volver a usar este comando.` }, { quoted: msg });
  }

  const mascota = usuario.mascotas[0];
  mascota.nivel = mascota.nivel || 1;
  mascota.xp = mascota.xp || 0;
  mascota.habilidades = Array.isArray(mascota.habilidades) && mascota.habilidades.length >= 2
    ? mascota.habilidades
    : [
        { nombre: "Habilidad Mascota 1", nivel: 1, xp: 0 },
        { nombre: "Habilidad Mascota 2", nivel: 1, xp: 0 }
      ];
  for (const h of mascota.habilidades) { h.nivel = h.nivel || 1; h.xp = h.xp || 0; }

  // Recompensas aleatorias
  const creditosOtorgados = Math.floor(Math.random() * (CREDITOS_MAX - CREDITOS_MIN + 1)) + CREDITOS_MIN;
  const xpOtorgada = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;

  usuario.ultimoSuperMascota = ahora;
  usuario.creditos = (usuario.creditos || 0) + creditosOtorgados;

  // Subida de nivel mascota
  let subioNivelMascota = false;
  mascota.xp += xpOtorgada;
  let xpNecesariaMascota = XP_MASCOTA_BASE + (mascota.nivel * 25);
  while (mascota.xp >= xpNecesariaMascota) {
    mascota.xp -= xpNecesariaMascota;
    mascota.nivel += 1;
    subioNivelMascota = true;
    xpNecesariaMascota = XP_MASCOTA_BASE + (mascota.nivel * 25);
  }

  // Subida de nivel habilidad aleatoria
  const idxHab = Math.random() < 0.5 ? 0 : 1;
  const hab = mascota.habilidades[idxHab];
  let habilidadSubida = null;
  if (hab.nivel < 100) {
    hab.xp += xpOtorgada;
    let xpNecesariaHab = XP_HAB_BASE + (hab.nivel * 12);
    while (hab.xp >= xpNecesariaHab && hab.nivel < 100) {
      hab.xp -= xpNecesariaHab;
      hab.nivel += 1;
      habilidadSubida = `${hab.nombre} (Nv ${hab.nivel})`;
      xpNecesariaHab = XP_HAB_BASE + (hab.nivel * 12);
    }
  }

  // Guardar cambios
  fs.writeFileSync(sukirpgPath, JSON.stringify(db, null, 2));

  // Mensaje final
  const base = TEXTOS_SUPERMASCOTA[Math.floor(Math.random() * TEXTOS_SUPERMASCOTA.length)]
    .replace("{nombre}", `${usuario.nombre} ${usuario.apellido}`.trim())
    .replace("{mascota}", mascota.nombre || "tu mascota")
    .replace("{creditos}", creditosOtorgados)
    .replace("{xp}", xpOtorgada);

  let mensajeFinal = base;
  if (subioNivelMascota) mensajeFinal += `\n\n🎉 *¡${mascota.nombre || "Tu mascota"} subió a nivel ${mascota.nivel}!*`;
  if (habilidadSubida) mensajeFinal += `\n\n✨ *Habilidad de mascota mejorada:* ${habilidadSubida}`;

  await conn.sendMessage(chatId, { text: mensajeFinal }, { quoted: msg });
  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["supermascota", "supermas"];
module.exports = handler;
