// plugins/setname.js
const fs = require("fs");
const path = require("path");

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

/** Extrae texto del mensaje citado (maneja wrappers comunes) */
function getQuotedText(msg) {
  const q = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!q) return null;
  return (
    q.conversation ||
    q?.extendedTextMessage?.text ||
    q?.ephemeralMessage?.message?.conversation ||
    q?.ephemeralMessage?.message?.extendedTextMessage?.text ||
    q?.viewOnceMessageV2?.message?.conversation ||
    q?.viewOnceMessageV2?.message?.extendedTextMessage?.text ||
    q?.viewOnceMessageV2Extension?.message?.conversation ||
    q?.viewOnceMessageV2Extension?.message?.extendedTextMessage?.text ||
    null
  );
}

const handler = async (msg, { conn, args }) => {
  const chatId    = msg.key.remoteJid;
  const isGroup   = chatId.endsWith("@g.us");
  const senderJid = msg.key.participant || msg.key.remoteJid; // puede ser @lid
  const senderNo  = DIGITS(senderJid);
  const isFromMe  = !!msg.key.fromMe;

  if (!isGroup) {
    await conn.sendMessage(chatId, { text: "❌ *Este comando solo se puede usar en grupos.*" }, { quoted: msg });
    return;
  }

  // Permisos LID-aware
  const isAdmin = await isAdminByNumber(conn, chatId, senderNo);

  // Owners desde owner.json (fallback a global.owner)
  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath)
    ? JSON.parse(fs.readFileSync(ownerPath, "utf-8"))
    : (global.owner || []);
  const isOwner = Array.isArray(owners) && owners.some(([id]) => id === senderNo);

  if (!isAdmin && !isOwner && !isFromMe) {
    await conn.sendMessage(chatId, {
      text: "⛔ *Solo administradores u owners pueden cambiar el nombre del grupo.*"
    }, { quoted: msg });
    return;
  }

  // Nombre: args o texto citado
  let nuevoNombre = (args || []).join(" ").trim();
  if (!nuevoNombre) {
    const qtext = (getQuotedText(msg) || "").trim();
    if (qtext) nuevoNombre = qtext;
  }

  if (!nuevoNombre) {
    await conn.sendMessage(chatId, {
      text: "ℹ️ *Debes escribir o responder con el nuevo nombre del grupo.*\n\nEjemplos:\n• *.setname La Familia de Suki 💕*\n• Responde a un mensaje con *.setname*"
    }, { quoted: msg });
    return;
  }

  // Evitar errores por longitud (WhatsApp suele aceptar ~100 chars)
  nuevoNombre = nuevoNombre.slice(0, 100);

  try {
    await conn.sendMessage(chatId, { react: { text: "✏️", key: msg.key } }).catch(() => {});
    await conn.groupUpdateSubject(chatId, nuevoNombre);

    await conn.sendMessage(chatId, {
      text: `✅ *Nombre del grupo actualizado con éxito.*\n\n📝 *Nuevo nombre:*\n${nuevoNombre}`
    }, { quoted: msg });

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {});
  } catch (error) {
    console.error("❌ Error al cambiar el nombre del grupo:", error);
    await conn.sendMessage(chatId, {
      text: "❌ *Ocurrió un error al cambiar el nombre del grupo.*"
    }, { quoted: msg });
  }
};

handler.command = ["setname"];
module.exports = handler;
