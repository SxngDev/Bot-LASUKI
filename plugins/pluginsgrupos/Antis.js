// plugins/antis.js
const path = require("path");
const { setConfig } = requireFromRoot("db");

const DIGITS = (s = "") => String(s).replace(/\D/g, "");

/** Si un participante viene como @lid y tiene .jid (real), usa ese real */
function lidParser(participants = []) {
  try {
    return participants.map(v => ({
      id: (typeof v?.id === "string" && v.id.endsWith("@lid") && v.jid) ? v.jid : v.id,
      admin: v?.admin ?? null,
      raw: v
    }));
  } catch {
    return participants || [];
  }
}

/** Verifica admin por NÚMERO (funciona en grupos LID y no-LID) */
async function isAdminByNumber(conn, chatId, number) {
  try {
    const meta = await conn.groupMetadata(chatId);
    const raw  = Array.isArray(meta?.participants) ? meta.participants : [];
    const norm = lidParser(raw);

    const adminNums = new Set();
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i], n = norm[i];
      const flag = (r?.admin === "admin" || r?.admin === "superadmin" ||
                    n?.admin === "admin" || n?.admin === "superadmin");
      if (flag) {
        [r?.id, r?.jid, n?.id].forEach(x => {
          const d = DIGITS(x || "");
          if (d) adminNums.add(d);
        });
      }
    }
    return adminNums.has(number);
  } catch {
    return false;
  }
}

const handler = async (msg, { conn }) => {
  const chatId    = msg.key.remoteJid;
  const senderJid = msg.key.participant || msg.key.remoteJid; // puede ser @lid
  const senderNo  = DIGITS(senderJid);
  const isFromMe  = !!msg.key.fromMe;

  // Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "🛡️", key: msg.key } }).catch(() => {});

  // Solo grupos
  if (!chatId.endsWith("@g.us")) {
    await conn.sendMessage(chatId, {
      text: "❌ *Este comando solo puede usarse en grupos.*"
    }, { quoted: msg });
    return;
  }

  // Permisos: admin/owner/bot
  const isAdmin = await isAdminByNumber(conn, chatId, senderNo);

  // Owners (owner.json o global.owner)
  const ownerPath = path.resolve("owner.json");
  const owners = (() => {
    try { return require(ownerPath); } catch { return global.owner || []; }
  })();
  const isOwner = Array.isArray(owners) && owners.some(([id]) => id === senderNo);

  if (!isAdmin && !isOwner && !isFromMe) {
    await conn.sendMessage(chatId, {
      text: "⛔ *Solo los administradores u owners pueden activar o desactivar el modo anti stickers.*"
    }, { quoted: msg });
    return;
  }

  // Leer opción (on/off)
  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    "";
  const opt = (body.trim().split(/\s+/)[1] || "").toLowerCase();

  if (!["on", "off"].includes(opt)) {
    await conn.sendMessage(chatId, {
      text: "⚙️ Usa: *antis on* o *antis off* para activar o desactivar el modo anti stickers."
    }, { quoted: msg });
    return;
  }

  const valor = opt === "on" ? 1 : 0;
  await setConfig(chatId, "antis", valor);

  await conn.sendMessage(chatId, {
    text: `✅ *Modo anti stickers* ${valor ? "activado" : "desactivado"} correctamente.`
  }, { quoted: msg });

  await conn.sendMessage(chatId, {
    react: { text: valor ? "🛡️" : "❌", key: msg.key }
  }).catch(() => {});
};

handler.command = ["antis"];
module.exports = handler;
