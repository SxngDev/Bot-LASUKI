// plugins/lidsu.js
// Saca el **número REAL** del usuario CITADO en grupos LID,
// usando la lógica del "lidParser" (si el participante trae .jid = real).
// Si no hay cita, usa al autor del mensaje como objetivo.

const DIGITS = (s = "") => (s || "").replace(/\D/g, "");

/** Normaliza participantes: si id es @lid y hay .jid (real), usa .jid; si no, deja id tal cual */
function lidParser(participants = []) {
  try {
    return participants.map(v => ({
      id: (typeof v?.id === "string" && v.id.endsWith("@lid") && v.jid) ? v.jid : v.id,
      admin: v?.admin ?? null,
      raw: v // guardamos ref cruda por si hace falta
    }));
  } catch (e) {
    console.error("[lidsu] lidParser error:", e);
    return participants || [];
  }
}

/** Intenta obtener el JID del citado desde varias rutas */
function getQuotedKey(msg) {
  const q = msg.quoted;
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  return (
    q?.key?.participant ||
    q?.key?.jid ||
    (typeof ctx?.participant === "string" ? ctx.participant : null) ||
    null
  );
}

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  if (!chatId.endsWith("@g.us")) {
    return conn.sendMessage(chatId, { text: "❌ Usa este comando en un *grupo*." }, { quoted: msg });
  }

  // Pequeña reacción
  try { await conn.sendMessage(chatId, { react: { text: "🛰️", key: msg.key } }); } catch {}

  // Metadata del grupo
  let meta;
  try {
    meta = await conn.groupMetadata(chatId);
  } catch (e) {
    console.error("[lidsu] metadata error:", e);
    return conn.sendMessage(chatId, { text: "❌ No pude leer la metadata del grupo." }, { quoted: msg });
  }

  const participants = Array.isArray(meta?.participants) ? meta.participants : [];
  // Aplica lógica tipo "sock.lidParser"
  const normalized = lidParser(participants);

  // Objetivo: citado si existe; si no, autor
  const quotedKey = getQuotedKey(msg);
  const targetKey = quotedKey || msg.key.participant || msg.key.jid || msg.key.remoteJid;

  if (!targetKey) {
    return conn.sendMessage(chatId, { text: "❌ No pude identificar al usuario objetivo." }, { quoted: msg });
  }

  let realJid = null;

  if (typeof targetKey === "string" && targetKey.endsWith("@s.whatsapp.net")) {
    // Ya es visible (grupo no-lid o cita visible en lid)
    realJid = targetKey;
  } else if (typeof targetKey === "string" && targetKey.endsWith("@lid")) {
    // Buscar ese miembro en la lista cruda por índice y/o por id
    const idx = participants.findIndex(p => p?.id === targetKey);
    if (idx >= 0) {
      const raw = participants[idx];
      // Si el wrapper trae .jid con el real, úsalo
      if (typeof raw?.jid === "string" && raw.jid.endsWith("@s.whatsapp.net")) {
        realJid = raw.jid;
      } else {
        // Si nuestro parser normalizó ese índice a real, úsalo
        const maybeReal = normalized[idx]?.id;
        if (typeof maybeReal === "string" && maybeReal.endsWith("@s.whatsapp.net")) {
          realJid = maybeReal;
        }
      }
    }
    // Fallback: si no está por índice, intenta por búsqueda en normalizados
    if (!realJid) {
      const hit = normalized.find(n => n?.raw?.id === targetKey && typeof n?.id === "string" && n.id.endsWith("@s.whatsapp.net"));
      if (hit) realJid = hit.id;
    }
  }

  if (!realJid) {
    return conn.sendMessage(chatId, { text: "❌ No pude resolver el *número real* del citado." }, { quoted: msg });
  }

  const numero = DIGITS(realJid);
  const texto = `📡 *Real del citado*\n📱 +${numero}\n🔑 JID: \`${realJid}\``;

  await conn.sendMessage(chatId, { text: texto }, { quoted: msg });
  try { await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } }); } catch {}
};

handler.command = ["lidsu"];
module.exports = handler;
