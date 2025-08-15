// plugins/modoadmins.js
const path = require("path");
const { getConfig, setConfig, deleteConfig } = requireFromRoot("db");

const DIGITS = (s = "") => String(s || "").replace(/\D/g, "");

/** Busca un participante por dígitos (coincide por p.id o p.jid) */
function findParticipantByDigits(parts = [], digits = "") {
  if (!digits) return null;
  return parts.find(
    p => DIGITS(p?.id || "") === digits || DIGITS(p?.jid || "") === digits
  ) || null;
}

const handler = async (msg, { conn }) => {
  try {
    const chatId    = msg.key.remoteJid;
    const isGroup   = chatId.endsWith("@g.us");
    const fromMe    = !!msg.key.fromMe;

    if (!isGroup) {
      await conn.sendMessage(chatId, { text: "❌ Este comando solo se puede usar en grupos." }, { quoted: msg });
      return;
    }

    // Autor (si tu index define msg.realJid, úsalo para obtener dígitos reales)
    const senderRaw = msg.key.participant || msg.key.remoteJid; // puede ser @lid
    const senderNum = DIGITS(typeof msg.realJid === "string" ? msg.realJid : senderRaw);

    // Metadata del grupo (funciona en LID/NO-LID)
    const metadata = await conn.groupMetadata(chatId);
    const participantes = Array.isArray(metadata?.participants) ? metadata.participants : [];

    // ¿El autor es admin?
    const authorP = findParticipantByDigits(participantes, senderNum);
    const isAdmin = !!authorP && (authorP.admin === "admin" || authorP.admin === "superadmin");

    // Solo admins (o el propio bot con fromMe)
    if (!isAdmin && !fromMe) {
      await conn.sendMessage(chatId, { text: "❌ Solo los administradores del grupo pueden usar este comando." }, { quoted: msg });
      return;
    }

    // Leer args del mensaje
    const messageText =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";
    const args   = messageText.trim().split(/\s+/).slice(1);
    const estado = (args[0] || "").toLowerCase();

    if (!["on", "off"].includes(estado)) {
      await conn.sendMessage(chatId, { text: "✳️ Usa correctamente:\n\n.modoadmins on / off" }, { quoted: msg });
      return;
    }

    if (estado === "on") {
      setConfig(chatId, "modoadmins", 1);
    } else {
      deleteConfig(chatId, "modoadmins");
    }

    await conn.sendMessage(chatId, { text: `👑 Modo admins *${estado === "on" ? "activado" : "desactivado"}* en este grupo.` }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {});

  } catch (err) {
    console.error("❌ Error en modoadmins:", err);
    await conn.sendMessage(msg.key.remoteJid, { text: "❌ Ocurrió un error al cambiar el modo admins." }, { quoted: msg });
    await conn.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
  }
};

handler.command = ["modoadmins"];
module.exports = handler;
