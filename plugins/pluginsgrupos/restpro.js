// plugins/restpro.js
const fs = require("fs");
const path = require("path");

const DIGITS = (s = "") => String(s).replace(/\D/g, "");

/** Normaliza: si un participante viene como @lid y tiene .jid (real), usa ese real */
function lidParser(participants = []) {
  try {
    return participants.map(v => ({
      id: (typeof v?.id === "string" && v.id.endsWith("@lid") && v.jid)
        ? v.jid
        : v.id,
      admin: v?.admin ?? null,
      raw: v
    }));
  } catch {
    return participants || [];
  }
}

/** ¿Es admin por NÚMERO? (funciona en LID y no-LID) */
async function isAdminByNumber(conn, chatId, number) {
  try {
    const meta = await conn.groupMetadata(chatId);
    const raw  = Array.isArray(meta?.participants) ? meta.participants : [];
    const norm = lidParser(raw);

    for (let i = 0; i < raw.length; i++) {
      const r = raw[i], n = norm[i];
      const isAdm = (r?.admin === "admin" || r?.admin === "superadmin" ||
                     n?.admin === "admin" || n?.admin === "superadmin");
      if (!isAdm) continue;
      const ids = [r?.id, r?.jid, n?.id];
      if (ids.some(x => DIGITS(x || "") === number)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Resuelve el JID REAL del target si viene como @lid (devuelve { realJid, lidJid }) */
async function resolveTargetJids(conn, chatId, targetId) {
  const result = { realJid: null, lidJid: null };
  if (!targetId || typeof targetId !== "string") return result;

  if (targetId.endsWith("@s.whatsapp.net")) {
    result.realJid = targetId;
    return result;
  }
  if (!targetId.endsWith("@lid")) return result;

  result.lidJid = targetId;

  try {
    const meta = await conn.groupMetadata(chatId);
    const raw  = Array.isArray(meta?.participants) ? meta.participants : [];
    const norm = lidParser(raw);

    // 1) por índice
    const idx = raw.findIndex(p => p?.id === targetId);
    if (idx >= 0) {
      const r = raw[idx];
      if (typeof r?.jid === "string" && r.jid.endsWith("@s.whatsapp.net")) {
        result.realJid = r.jid;
        return result;
      }
      const n = norm[idx];
      if (typeof n?.id === "string" && n.id.endsWith("@s.whatsapp.net")) {
        result.realJid = n.id;
        return result;
      }
    }
    // 2) fallback: buscar en normalizados
    const hit = norm.find(n => n?.raw?.id === targetId && typeof n?.id === "string" && n.id.endsWith("@s.whatsapp.net"));
    if (hit) result.realJid = hit.id;
  } catch {}
  return result;
}

const handler = async (msg, { conn }) => {
  const chatId   = msg.key.remoteJid;
  const isGroup  = chatId.endsWith("@g.us");
  const senderId = msg.key.participant || msg.key.remoteJid; // puede ser @lid
  const senderNo = DIGITS(senderId);
  const isFromMe = !!msg.key.fromMe;

  if (!isGroup) {
    return conn.sendMessage(chatId, { text: "❌ *Este comando solo se puede usar en grupos.*" }, { quoted: msg });
  }

  // Permisos: admin/owner/bot (LID-aware)
  const isAdmin = await isAdminByNumber(conn, chatId, senderNo);

  // Owners (owner.json o global.owner)
  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath)
    ? JSON.parse(fs.readFileSync(ownerPath, "utf-8"))
    : (global.owner || []);
  const isOwner = Array.isArray(owners) && owners.some(([id]) => id === senderNo);

  if (!isAdmin && !isOwner && !isFromMe) {
    return conn.sendMessage(chatId, {
      text: "⛔ *Solo administradores u owners pueden usar este comando.*"
    }, { quoted: msg });
  }

  // ——— Obtener target de respuesta o mención ———
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  let targetId =
    (typeof ctx?.participant === "string" && ctx.participant) ||
    (Array.isArray(ctx?.mentionedJid) && ctx.mentionedJid[0]) ||
    null;

  if (!targetId) {
    return conn.sendMessage(chatId, {
      text: "⚠️ *Debes mencionar o responder al usuario que deseas restaurar de la lista negra.*"
    }, { quoted: msg });
  }

  // Resolver real/lid del target
  const { realJid, lidJid } = await resolveTargetJids(conn, chatId, targetId);
  const targetReal = realJid || (DIGITS(targetId) ? `${DIGITS(targetId)}@s.whatsapp.net` : null);
  const targetNum  = DIGITS(targetReal || targetId);

  // ——— Cargar y limpiar la blacklist con todas las variantes ———
  const filePath = path.resolve("setwelcome.json");
  const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : {};
  data[chatId] = data[chatId] || {};
  data[chatId].blacklistAdmins = data[chatId].blacklistAdmins || {};

  // posibles llaves guardadas
  const candidateKeys = new Set([
    targetId,
    targetReal,
    lidJid,
    `${targetNum}@s.whatsapp.net`,
    `${targetNum}@lid`,
    targetNum
  ].filter(Boolean));

  let removed = false;
  for (const key of candidateKeys) {
    if (key in data[chatId].blacklistAdmins) {
      delete data[chatId].blacklistAdmins[key];
      removed = true;
    }
  }

  if (removed) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return conn.sendMessage(chatId, {
      text: `✅ *El usuario @${targetNum} ha sido restaurado y puede volver a ser admin.*`,
      mentions: [targetReal || targetId]
    }, { quoted: msg });
  } else {
    return conn.sendMessage(chatId, {
      text: `ℹ️ *El usuario @${targetNum} no está en la lista negra.*`,
      mentions: [targetReal || targetId]
    }, { quoted: msg });
  }
};

handler.command = ["restpro"];
handler.help = ["restpro"];
handler.tags = ["grupo"];

module.exports = handler;
