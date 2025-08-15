const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

// Estado de broadcasts pendientes, indexado por ID del mensaje de listado
const pendingBc2 = {};

// Adjunta el listener de segunda fase una sola vez
function attachBc2Listener(conn) {
  if (conn._bc2Listener) return;
  conn._bc2Listener = true;

  conn.ev.on("messages.upsert", async ({ messages }) => {
    for (const m of messages) {
      try {
        const ctx         = m.message?.extendedTextMessage?.contextInfo;
        const listedMsgId = ctx?.stanzaId;
        if (!listedMsgId || !pendingBc2[listedMsgId]) continue;

        const job = pendingBc2[listedMsgId];

        // Leemos el texto del USUARIO que cita el listado
        let text = "";
        if (m.message.conversation) {
          text = m.message.conversation;
        } else if (m.message.extendedTextMessage?.text) {
          text = m.message.extendedTextMessage.text;
        }
        text = text.trim();

        // Reacciona al recibir la selección
        await conn.sendMessage(job.chatId, { react: { text: "🚀", key: m.key } });

        // parsear índices: “1 3 5” → [0,2,4]
        const picks = [...new Set(
          text.split(/\s+/)
              .map(n => parseInt(n,10) - 1)
              .filter(i => i >= 0 && i < job.groupIds.length)
        )];

        if (!picks.length) {
          await conn.sendMessage(job.chatId,
            { text: "❌ Selección inválida. Escribe los números separados por espacios." },
            { quoted: m }
          );
        } else {
          // enviamos solo a los elegidos
          for (const idx of picks) {
            const gid = job.groupIds[idx];
            try {
              await conn.sendMessage(gid, job.broadcastMsg);
            } catch (e) {
              console.error("Error enviando bc2 a", gid, e);
            }
            await new Promise(r => setTimeout(r, 1000));
          }
          delete pendingBc2[listedMsgId];
          await conn.sendMessage(job.chatId,
            { text: `✅ Broadcast enviado a ${picks.length} grupo(s).` },
            { quoted: job.commandMsg }
          );
        }
      } catch (e) {
        console.error("🛑 Error en bc2 listener:", e);
      }
    }
  });
}

module.exports = async (msg, { conn, command }) => {
  const chatId   = msg.key.remoteJid;
  const senderId = (msg.key.participant || chatId).split("@")[0];

  // Solo owner
  const ownersPath = path.resolve("owner.json");
  const owners     = fs.existsSync(ownersPath)
    ? JSON.parse(fs.readFileSync(ownersPath, "utf-8"))
    : [];
  const isOwner = owners.some(([id]) => id === senderId);
  if (!isOwner && !msg.key.fromMe) {
    return conn.sendMessage(chatId,
      { text: "⚠️ Solo el *Owner* puede usar este comando." },
      { quoted: msg }
    );
  }

  const quotedCtx = msg.message?.extendedTextMessage?.contextInfo;
  const cited     = quotedCtx?.quotedMessage;

  // === Paso 1: Generar listado ===
  if (cited) {
    // Header del broadcast
    const fecha  = new Date().toLocaleString("es-ES", { timeZone: "America/Argentina/Buenos_Aires" });
    const header = `📢 *COMUNICADO OFICIAL DE SUKI BOT* 📢\n──────────────\n🕒 Fecha: ${fecha}\n──────────────\n\n`;

    // Construir broadcastMsg con todos los tipos soportados
    let broadcastMsg = {};
    if (cited.conversation) {
      broadcastMsg = { text: header + cited.conversation };
    } else if (cited.extendedTextMessage?.text) {
      broadcastMsg = { text: header + cited.extendedTextMessage.text };
    } else if (cited.imageMessage) {
      const stream = await downloadContentFromMessage(cited.imageMessage, "image");
      let buf = Buffer.alloc(0);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
      broadcastMsg = { image: buf, caption: header + (cited.imageMessage.caption||"") };
    } else if (cited.videoMessage) {
      const stream = await downloadContentFromMessage(cited.videoMessage, "video");
      let buf = Buffer.alloc(0);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
      broadcastMsg = {
        video: buf,
        caption: header + (cited.videoMessage.caption||""),
        gifPlayback: cited.videoMessage.gifPlayback||false
      };
    } else if (cited.audioMessage) {
      const stream = await downloadContentFromMessage(cited.audioMessage, "audio");
      let buf = Buffer.alloc(0);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
      // enviamos header por separado
      await conn.sendMessage(chatId, { text: header }, { quoted: msg });
      broadcastMsg = { audio: buf, mimetype: "audio/mpeg" };
    } else if (cited.stickerMessage) {
      const stream = await downloadContentFromMessage(cited.stickerMessage, "sticker");
      let buf = Buffer.alloc(0);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
      await conn.sendMessage(chatId, { text: header }, { quoted: msg });
      broadcastMsg = { sticker: buf };
    } else {
      return conn.sendMessage(chatId,
        { text: "❌ Tipo de mensaje no soportado para bc2." },
        { quoted: msg }
      );
    }

    // Obtener lista de grupos
    let groups;
    try {
      groups = await conn.groupFetchAllParticipating();
    } catch {
      return conn.sendMessage(chatId,
        { text: "❌ Error al obtener la lista de grupos." },
        { quoted: msg }
      );
    }
    const groupIds = Object.keys(groups);
    if (!groupIds.length) {
      return conn.sendMessage(chatId,
        { text: "❌ No estoy en ningún grupo." },
        { quoted: msg }
      );
    }

    // Enviar listado numerado citando tu comando
    const listado = groupIds.map((id, i) => `${i+1}. ${groups[id].subject || id}`).join("\n");
    const preview = await conn.sendMessage(chatId,
      { text:
`📋 *Elige a qué grupos enviar:*
${listado}

✍️ Cita este mensaje y responde con los números (ej: 1 3 5).`
      },
      { quoted: msg }
    );

    // Guardar estado y activar listener
    pendingBc2[preview.key.id] = {
      chatId,
      groupIds,
      broadcastMsg,
      commandMsg: msg
    };
    attachBc2Listener(conn);
  }
};

module.exports.command = ["bc2"];
