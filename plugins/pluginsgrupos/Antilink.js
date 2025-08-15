// plugins/antilink.js
const path = require("path");
const { getConfig, setConfig, deleteConfig } = requireFromRoot("db");

const DIGITS = (s = "") => String(s).replace(/\D/g, "");

/** Normaliza: si un participante viene como @lid y tiene .jid (real), usa ese real */
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

/** Verifica admin por NÚMERO (funciona en LID y no-LID) */
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

  // Reacción inicial (ignora errores)
  await conn.sendMessage(chatId, { react: { text: "🕵️", key: msg.key } }).catch(() => {});

  // Solo grupos
  if (!chatId.endsWith("@g.us")) {
    await conn.sendMessage(chatId, {
      text: "❌ Este comando solo puede usarse en grupos."
    }, { quoted: msg });
    return;
  }

  // Permisos: admin/owner/bot (admin por número real para LID)
  const isAdmin = await isAdminByNumber(conn, chatId, senderNo);

  // Owners: owner.json o global.owner
  const ownerPath = path.resolve("owner.json");
  const owners = (() => {
    try { return require(ownerPath); } catch { return global.owner || []; }
  })();
  const isOwner = Array.isArray(owners) && owners.some(([id]) => id === senderNo);

  if (!isAdmin && !isOwner && !isFromMe) {
    await conn.sendMessage(chatId, {
      text: "🚫 Solo los administradores pueden usar este comando."
    }, { quoted: msg });
    return;
  }

  // Args
  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    "";
  const args   = body.trim().split(/\s+/).slice(1);
  const estado = (args[0] || "").toLowerCase();

  if (!["on", "off"].includes(estado)) {
    await conn.sendMessage(chatId, {
      text: `✳️ Usa correctamente:\n\n.antilink on / off`
    }, { quoted: msg });
    return;
  }

  if (estado === "on") {
    setConfig(chatId, "antilink", 1);
  } else {
    deleteConfig(chatId, "antilink");
  }

  await conn.sendMessage(chatId, {
    text: `🔗 AntiLink ha sido *${estado === "on" ? "activado" : "desactivado"}* correctamente en este grupo.`
  }, { quoted: msg });

  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {});
  console.log(`📌 AntiLink ${estado.toUpperCase()} guardado en activos.db para ${chatId}`);
};

handler.command = ["antilink"];
module.exports = handler;
