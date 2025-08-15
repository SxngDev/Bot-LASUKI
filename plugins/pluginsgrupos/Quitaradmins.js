// plugins/quitaradmins.js
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

/** Convierte una lista de JIDs (posible @lid) a JIDs reales @s.whatsapp.net */
async function mapJidsToReal(conn, chatId, jids = []) {
  const out = [];
  try {
    const meta = await conn.groupMetadata(chatId);
    const raw  = Array.isArray(meta?.participants) ? meta.participants : [];
    const norm = lidParser(raw);

    for (const jid of jids) {
      if (typeof jid !== "string") continue;
      if (jid.endsWith("@s.whatsapp.net")) { out.push(jid); continue; }
      if (jid.endsWith("@lid")) {
        // por índice
        const idx = raw.findIndex(p => p?.id === jid);
        if (idx >= 0) {
          const real = (raw[idx]?.jid && raw[idx].jid.endsWith("@s.whatsapp.net"))
            ? raw[idx].jid
            : (norm[idx]?.id?.endsWith?.("@s.whatsapp.net") ? norm[idx].id : null);
          if (real) { out.push(real); continue; }
        }
        // fallback por dígitos
        const d = DIGITS(jid);
        const hit = norm.find(n => DIGITS(n?.id || "") === d || DIGITS(n?.raw?.id || "") === d);
        if (hit?.id?.endsWith?.("@s.whatsapp.net")) { out.push(hit.id); continue; }
      }
      // si no se pudo resolver, empuja tal cual (último recurso)
      out.push(jid);
    }
  } catch {
    return jids;
  }
  return Array.from(new Set(out)); // dedup
}

const handler = async (msg, { conn }) => {
  const chatId   = msg.key.remoteJid;
  const isGroup  = chatId.endsWith("@g.us");
  const senderId = msg.key.participant || msg.key.remoteJid; // puede ser @lid
  const senderNo = DIGITS(senderId);
  const isFromMe = !!msg.key.fromMe;

  if (!isGroup) {
    await conn.sendMessage(chatId, { text: "❌ *Este comando solo puede usarse en grupos.*" }, { quoted: msg });
    return;
  }

  // Permisos: admin/owner/bot
  const isAdmin = await isAdminByNumber(conn, chatId, senderNo);

  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath)
    ? JSON.parse(fs.readFileSync(ownerPath, "utf-8"))
    : (global.owner || []);
  const isOwner = Array.isArray(owners) && owners.some(([id]) => id === senderNo);

  if (!isAdmin && !isOwner && !isFromMe) {
    await conn.sendMessage(chatId, {
      text: "⛔ *Solo administradores o dueños del bot pueden usar este comando.*"
    }, { quoted: msg });
    return;
  }

  // Objetivos: menciones o respuesta
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const mentioned = Array.isArray(ctx?.mentionedJid) ? ctx.mentionedJid : [];
  const replied   = ctx?.participant ? [ctx.participant] : [];
  let targets     = [...mentioned, ...replied];

  if (!targets.length) {
    await conn.sendMessage(chatId, {
      text: "📌 *Debes mencionar o citar al usuario que quieres quitar como administrador.*"
    }, { quoted: msg });
    return;
  }

  // Resolver objetivos a JIDs reales (LID → real)
  const realTargets = await mapJidsToReal(conn, chatId, targets);

  // Cargar metadata para revisar admins actuales y protegidos
  let meta = {};
  try { meta = await conn.groupMetadata(chatId); } catch {}
  const raw  = Array.isArray(meta?.participants) ? meta.participants : [];
  const norm = lidParser(raw);

  const creatorJid = meta?.owner || null; // creador del grupo (si está disponible)
  const botJid = conn.user?.id?.split?.(":")?.[0] ? conn.user.id.split(":")[0] + "@s.whatsapp.net" : null;

  const isAdminJid = (jid) => {
    const idx = norm.findIndex(p => p?.id === jid);
    if (idx >= 0) {
      const r = raw[idx], n = norm[idx];
      return (r?.admin === "admin" || r?.admin === "superadmin" ||
              n?.admin === "admin" || n?.admin === "superadmin");
    }
    const d = DIGITS(jid);
    const hit = norm.find(p => DIGITS(p?.id || "") === d);
    return !!(hit && (hit.admin === "admin" || hit.admin === "superadmin"));
  };

  const protectedJid = (jid) => {
    const num = DIGITS(jid);
    const isOwnerBot = Array.isArray(owners) && owners.some(([id]) => id === num);
    return (creatorJid && jid === creatorJid) || (botJid && jid === botJid) || isOwnerBot;
  };

  const toDemote = [];
  const notAdmin = [];
  const protectedOnes = [];

  for (const jid of realTargets) {
    if (protectedJid(jid)) { protectedOnes.push(jid); continue; }
    if (!isAdminJid(jid)) { notAdmin.push(jid); continue; }
    toDemote.push(jid);
  }

  // Ejecutar demote
  let ok = [];
  let fail = [];
  if (toDemote.length) {
    try {
      await conn.groupParticipantsUpdate(chatId, toDemote, "demote");
      ok = toDemote;
    } catch (e) {
      console.error("❌ Error al quitar admin:", e);
      fail = toDemote;
    }
  }

  // Resumen
  const tag = (jid) => `@${DIGITS(jid)}`;
  const lines = [];
  if (ok.length)         lines.push(`✅ *Se quitó admin a:* ${ok.map(tag).join(", ")}`);
  if (notAdmin.length)   lines.push(`ℹ️ *No eran admin:* ${notAdmin.map(tag).join(", ")}`);
  if (protectedOnes.length) lines.push(`🛡️ *Protegidos (no se quita):* ${protectedOnes.map(tag).join(", ")}`);
  if (fail.length)       lines.push(`❌ *No se pudo quitar admin a:* ${fail.map(tag).join(", ")}`);

  await conn.sendMessage(chatId, {
    text: lines.join("\n"),
    mentions: [...ok, ...notAdmin, ...protectedOnes, ...fail]
  }, { quoted: msg });
};

handler.command = ["quitaradmins"];
module.exports = handler;
