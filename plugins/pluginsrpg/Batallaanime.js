// plugins/batallaanime.js
const fs = require("fs");
const path = require("path");

const COOLDOWN_MS = 7 * 60 * 1000; // 7 min
const RETO_MS = 2 * 60 * 1000;     // 2 min

const FILE = path.join(process.cwd(), "sukirpg.json");
const load = () => fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf-8")) : { usuarios: [] };
const save = (db) => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
const jid = (msg) => msg.key.participant || msg.key.remoteJid;

const handler = async (msg, { conn, command }) => {
  const chatId = msg.key.remoteJid;
  const userId = jid(msg); // JID completo (con @)
  const pref = global.prefix || ".";

  // cargar DB
  let db = load();
  db.usuarios = db.usuarios || [];
  // en tu estructura usas array; buscamos por .numero (numérico)
  const toNum = (j) => String(j || "").replace(/\D/g, "");
  const myNum = toNum(userId);

  const me = db.usuarios.find(u => u.numero === myNum);
  if (!me) {
    return conn.sendMessage(chatId, { text: `❌ *No estás registrado.* Usa \`${pref}rpg nombre apellido edad fechaNacimiento\`.` }, { quoted: msg });
  }
  if (!Array.isArray(me.personajes) || me.personajes.length === 0) {
    return conn.sendMessage(chatId, { text: `❌ *No tienes un personaje.* Compra uno en la tienda.` }, { quoted: msg });
  }

  // cooldown para lanzar reto
  me.cooldowns = me.cooldowns || {};
  if (me.cooldowns.batallaAnime && (Date.now() - me.cooldowns.batallaAnime) < COOLDOWN_MS) {
    const falt = Math.ceil((COOLDOWN_MS - (Date.now() - me.cooldowns.batallaAnime)) / 1000);
    return conn.sendMessage(chatId, { text: `⏳ *Debes esperar ${falt}s antes de usar \`${pref}${command}\` de nuevo.*` }, { quoted: msg });
  }

  // detectar oponente (citar o mencionar)
  let opponentId;
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (ctx?.quotedMessage) opponentId = ctx.participant;
  if (!opponentId && ctx?.mentionedJid?.length) opponentId = ctx.mentionedJid[0];
  if (!opponentId) {
    return conn.sendMessage(chatId, { text: `⚔️ *Menciona o responde (cita) a un usuario para retarlo.*` }, { quoted: msg });
  }
  const oppNum = toNum(opponentId);
  if (!oppNum || oppNum === myNum) {
    return conn.sendMessage(chatId, { text: `🙃 No puedes desafiarte a ti mismo.` }, { quoted: msg });
  }

  const opp = db.usuarios.find(u => u.numero === oppNum);
  if (!opp || !Array.isArray(opp.personajes) || opp.personajes.length === 0) {
    return conn.sendMessage(chatId, { text: `❌ *El oponente no tiene personaje registrado.*` }, { quoted: msg });
  }

  // armar mensaje de desafío mostrando stats parecidos a tu ejemplo
  const pMe = me.personajes[0];
  const pOpp = opp.personajes[0];

  const habsUser = (Array.isArray(pMe.habilidades) ? pMe.habilidades : []).map(h => `⚡ *${h.nombre}:* Nivel ${h.nivel||1}`).join("\n") || "—";
  const habsOpp  = (Array.isArray(pOpp.habilidades) ? pOpp.habilidades : []).map(h => `⚡ *${h.nombre}:* Nivel ${h.nivel||1}`).join("\n") || "—";

  const uTag = `${myNum}@s.whatsapp.net`;
  const oTag = `${oppNum}@s.whatsapp.net`;

  const mensajeDesafio =
`🎌 *¡Desafío de Batalla Anime!* 🎌

👤 *Retador:* @${myNum}
🎯 *Retado:* @${oppNum}

🗡️ *Personaje de @${myNum}:*
   • *Nombre:* ${pMe.nombre || "Tu personaje"}
   • *Nivel:* ${pMe.nivel || 1}
   • *Habilidades:*
${habsUser}

🛡️ *Personaje de @${oppNum}:*
   • *Nombre:* ${pOpp.nombre || "Su personaje"}
   • *Nivel:* ${pOpp.nivel || 1}
   • *Habilidades:*
${habsOpp}

@${oppNum}, responde con \`${pref}goper\` para aceptar.
⏳ *Tienes 2 minutos para aceptar.*`;

  await conn.sendMessage(chatId, { text: mensajeDesafio, mentions: [uTag, oTag] }, { quoted: msg });

  // guardar solicitud en el usuario retador
  me.battleRequest = {
    target: oTag,                // JID completo destino
    targetNum: oppNum,           // solo número
    time: Date.now(),
    type: "anime",
    chatId
  };
  me.cooldowns.batallaAnime = Date.now(); // fijamos cooldown al lanzar
  save(db);

  // expiración a 2 min
  setTimeout(() => {
    try {
      const d = load();
      const m2 = d.usuarios.find(u => u.numero === myNum);
      if (m2?.battleRequest &&
          m2.battleRequest.type === "anime" &&
          m2.battleRequest.targetNum === oppNum &&
          (Date.now() - m2.battleRequest.time) > RETO_MS) {
        delete m2.battleRequest;
        save(d);
        conn.sendMessage(chatId, { text: "⏳ *La solicitud de batalla anime ha expirado porque no fue aceptada a tiempo.*" })
          .catch(() => {});
      }
    } catch {}
  }, RETO_MS + 500);

  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["batallaanime", "batallaani"];
module.exports = handler;
