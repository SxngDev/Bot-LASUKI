// plugins/batallamascota.js
const fs = require("fs");
const path = require("path");

const COOLDOWN_MS = 7 * 60 * 1000;
const FILE = path.join(process.cwd(), "sukirpg.json");

const load = () => fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf-8")) : { usuarios: [] };
const save = (db) => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
const toNum = (j) => String(j || "").replace(/\D/g, "");

const handler = async (msg, { conn, command }) => {
  const chatId = msg.key.remoteJid;
  const myJid = msg.key.participant || msg.key.remoteJid;
  const myNum = toNum(myJid);

  await conn.sendMessage(chatId, { react: { text: "🐾", key: msg.key } });

  let db = load(); db.usuarios = db.usuarios || [];
  const me = db.usuarios.find(u => u.numero === myNum);
  if (!me) return conn.sendMessage(chatId, { text: "❌ *No estás registrado en el RPG.*" }, { quoted: msg });

  // Cooldown (retador)
  me.cooldowns = me.cooldowns || {};
  if (me.cooldowns.batallaMascota && (Date.now() - me.cooldowns.batallaMascota) < COOLDOWN_MS) {
    const falt = Math.ceil((COOLDOWN_MS - (Date.now() - me.cooldowns.batallaMascota))/1000);
    return conn.sendMessage(chatId, { text: `⏳ *Debes esperar ${falt}s para retar otra batalla de mascotas.*` }, { quoted: msg });
  }

  // Debe tener mascota
  if (!Array.isArray(me.mascotas) || me.mascotas.length === 0) {
    return conn.sendMessage(chatId, { text: "🐶 *No tienes mascota.* Compra una para poder batallar." }, { quoted: msg });
  }

  // Sacar oponente por cita o mención
  let opponentJid = null;
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (ctx?.quotedMessage) opponentJid = ctx.participant;
  if (!opponentJid && ctx?.mentionedJid?.length) opponentJid = ctx.mentionedJid[0];
  if (!opponentJid) {
    return conn.sendMessage(chatId, { text: "⚔️ *Menciona o responde a un usuario para retarlo (mascotas).*" }, { quoted: msg });
  }
  const oppNum = toNum(opponentJid);

  const opp = db.usuarios.find(u => u.numero === oppNum);
  if (!opp || !Array.isArray(opp.mascotas) || opp.mascotas.length === 0) {
    return conn.sendMessage(chatId, { text: "❌ *El oponente no tiene mascota registrada.*" }, { quoted: msg });
  }

  const mPet = me.mascotas[0];
  const oPet = opp.mascotas[0];

  const text =
`🎌 *¡Desafío de Batalla de Mascotas!* 🎌

👤 Retador: @${me.numero}
🎯 Retado: @${opp.numero}

🐾 *Mascota de @${me.numero}:* ${mPet.nombre || "Tu mascota"} (Nv ${mPet.nivel || 1})
🐾 *Mascota de @${opp.numero}:* ${oPet.nombre || "Su mascota"} (Nv ${oPet.nivel || 1})

🛡️ @${opp.numero}, responde con *.${global?.prefix || ""}gomascota* para aceptar.
⏳ *Tienes 2 minutos para aceptar.*`;

  await conn.sendMessage(chatId, {
    text,
    mentions: [`${me.numero}@s.whatsapp.net`, `${opp.numero}@s.whatsapp.net`]
  }, { quoted: msg });

  // Guardar solicitud
  me.battleRequest = { target: oppNum, time: Date.now(), type: "mascota" };
  me.cooldowns.batallaMascota = Date.now();
  save(db);

  // Expira en 2 minutos
  setTimeout(() => {
    try {
      const db2 = load();
      const me2 = db2.usuarios.find(u => u.numero === myNum);
      if (me2?.battleRequest &&
          me2.battleRequest.type === "mascota" &&
          toNum(me2.battleRequest.target) === oppNum) {
        delete me2.battleRequest;
        save(db2);
        conn.sendMessage(chatId, { text: "⏳ *La solicitud de batalla de mascotas expiró.*" }, { quoted: msg });
      }
    } catch {}
  }, 120000);
};

handler.command = ["batallamascota", "batallamas"];
module.exports = handler;
