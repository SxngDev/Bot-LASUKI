// plugins/antidelete.js
const fs = require("fs");
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

const handler = async (msg, { conn, args }) => {
  const chatId    = msg.key.remoteJid;
  const senderJid = msg.key.participant || msg.key.remoteJid; // puede ser @lid
  const senderNo  = DIGITS(senderJid);
  const isFromMe  = !!msg.key.fromMe;

  // Solo grupos
  if (!chatId.endsWith("@g.us")) {
    await conn.sendMessage(chatId, { text: "❌ *Este comando solo puede usarse en grupos.*" }, { quoted: msg });
    return;
  }

  await conn.sendMessage(chatId, { react: { text: "🛡️", key: msg.key } }).catch(() => {});

  // Permisos: admin/owner/bot
  const isAdmin = await isAdminByNumber(conn, chatId, senderNo);

  // Owners (owner.json o global.owner)
  let owners = [];
  try { owners = JSON.parse(fs.readFileSync(path.resolve("owner.json"), "utf-8")); }
  catch { owners = global.owner || []; }

  const isOwner = Array.isArray(owners) && owners.some(([id]) => id === senderNo);

  if (!isAdmin && !isOwner && !isFromMe) {
    await conn.sendMessage(chatId, {
      text: "⛔ *Solo administradores o dueños del bot pueden usar este comando.*"
    }, { quoted: msg });
    return;
  }

  // on/off desde args o desde el cuerpo del mensaje
  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    "";
  const estado = (args?.[0] || body.trim().split(/\s+/)[1] || "").toLowerCase();

  if (!["on", "off"].includes(estado)) {
    await conn.sendMessage(chatId, {
      text: "🎛️ *Usa:* `.antidelete on` o `.antidelete off`"
    }, { quoted: msg });
    return;
  }

  const nuevoEstado = estado === "on" ? 1 : 0;
  await setConfig(chatId, "antidelete", nuevoEstado);

  await conn.sendMessage(chatId, {
    text: `✅ *Antidelete* ha sido ${estado === "on" ? "*activado*" : "*desactivado*"} para este grupo.`
  }, { quoted: msg });

  await conn.sendMessage(chatId, {
    react: { text: estado === "on" ? "🛡️" : "❌", key: msg.key }
  }).catch(() => {});
};

handler.command = ["antidelete"];
module.exports = handler;
