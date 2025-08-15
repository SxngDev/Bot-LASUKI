// plugins/tag.js
const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const DIGITS = (s = "") => String(s || "").replace(/\D/g, "");

const handler = async (msg, { conn, args }) => {
  try {
    const chatId   = msg.key.remoteJid;
    const isGroup  = chatId.endsWith("@g.us");
    const isFromMe = !!msg.key.fromMe;

    // JID del autor (puede venir @lid). Si tu index ya define msg.realJid, lo usamos.
    const senderId      = msg.key.participant || msg.key.remoteJid;
    const senderRealJid = typeof msg.realJid === "string"
      ? msg.realJid
      : (senderId?.endsWith?.("@s.whatsapp.net") ? senderId : null);
    const senderNum     = DIGITS(senderRealJid || senderId);

    // Bot & owner
    const rawID   = conn.user?.id || "";
    const botNum  = DIGITS(rawID.split(":")[0]);
    const isBot   = botNum === senderNum;
    const isOwner = Array.isArray(global.owner) && global.owner.some(([id]) => id === senderNum);

    if (!isGroup) {
      return conn.sendMessage(chatId, { text: "⚠️ Este comando solo se puede usar en grupos." }, { quoted: msg });
    }

    await conn.sendMessage(chatId, { react: { text: "🔊", key: msg.key } }).catch(() => {});

    // Metadata
    let meta;
    try {
      meta = await conn.groupMetadata(chatId);
    } catch (e) {
      console.error("[tag] metadata error:", e);
      return conn.sendMessage(chatId, { text: "❌ No pude leer la metadata del grupo." }, { quoted: msg });
    }
    const participantes = Array.isArray(meta?.participants) ? meta.participants : [];

    // ¿Es admin? (soporta LID y no-LID). Matchea por p.id (puede ser @lid) o p.jid (real) y por dígitos.
    const authorCandidates = new Set([
      senderId,
      senderRealJid,
      `${senderNum}@s.whatsapp.net`,
      `${senderNum}@lid`
    ].filter(Boolean));

    const isAdmin = participantes.some(p => {
      const ids = [p?.id, (typeof p?.jid === "string" ? p.jid : "")].filter(Boolean);
      const matchById = ids.some(id => authorCandidates.has(id) || DIGITS(id) === senderNum);
      const roleOK = p?.admin === "admin" || p?.admin === "superadmin";
      return matchById && roleOK;
    });

    if (!isAdmin && !isOwner && !isBot && !isFromMe) {
      return conn.sendMessage(chatId, {
        text: "❌ Solo los administradores del grupo, el dueño del bot o el bot pueden usar este comando."
      }, { quoted: msg });
    }

    // MENCIONES: usa el JID que traiga el grupo (LID o real) y de-duplica por número
    const mentionIdsRaw = participantes.map(p => p?.id || p?.jid).filter(Boolean);
    const seen = new Set();
    const allMentions = [];
    for (const jid of mentionIdsRaw) {
      const d = DIGITS(jid);
      if (!seen.has(d)) {
        seen.add(d);
        allMentions.push(jid);
      }
    }

    // --- Construcción del mensaje a reenviar (texto o citado con media) ---
    let messageToForward = null;
    let hasMedia = false;

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (quoted) {
      if (quoted.conversation) {
        messageToForward = { text: quoted.conversation };
      } else if (quoted.extendedTextMessage?.text) {
        messageToForward = { text: quoted.extendedTextMessage.text };
      } else if (quoted.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, "image");
        let buffer = Buffer.alloc(0);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        messageToForward = {
          image: buffer,
          mimetype: quoted.imageMessage.mimetype || "image/jpeg",
          caption: quoted.imageMessage.caption || ""
        };
        hasMedia = true;
      } else if (quoted.videoMessage) {
        const stream = await downloadContentFromMessage(quoted.videoMessage, "video");
        let buffer = Buffer.alloc(0);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        messageToForward = {
          video: buffer,
          mimetype: quoted.videoMessage.mimetype || "video/mp4",
          caption: quoted.videoMessage.caption || ""
        };
        hasMedia = true;
      } else if (quoted.audioMessage) {
        const stream = await downloadContentFromMessage(quoted.audioMessage, "audio");
        let buffer = Buffer.alloc(0);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        messageToForward = {
          audio: buffer,
          mimetype: quoted.audioMessage.mimetype || "audio/mp3"
        };
        hasMedia = true;
      } else if (quoted.stickerMessage) {
        const stream = await downloadContentFromMessage(quoted.stickerMessage, "sticker");
        let buffer = Buffer.alloc(0);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        messageToForward = { sticker: buffer };
        hasMedia = true;
      } else if (quoted.documentMessage) {
        const stream = await downloadContentFromMessage(quoted.documentMessage, "document");
        let buffer = Buffer.alloc(0);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        messageToForward = {
          document: buffer,
          mimetype: quoted.documentMessage.mimetype || "application/pdf",
          caption: quoted.documentMessage.caption || ""
        };
        hasMedia = true;
      }
    }

    if (!hasMedia) {
      const textArg = (args || []).join(" ").trim();
      if (textArg.length > 0) {
        messageToForward = { text: textArg };
      }
    }

    if (!messageToForward) {
      return conn.sendMessage(chatId, {
        text: "⚠️ Debes responder a un mensaje o proporcionar un texto para reenviar."
      }, { quoted: msg });
    }

    await conn.sendMessage(chatId, { ...messageToForward, mentions: allMentions }, { quoted: msg });

  } catch (err) {
    console.error("❌ Error en el comando tag:", err);
    await conn.sendMessage(msg.key.remoteJid, { text: "❌ Ocurrió un error al ejecutar el comando." }, { quoted: msg });
  }
};

handler.command = ["tag"];
module.exports = handler;
