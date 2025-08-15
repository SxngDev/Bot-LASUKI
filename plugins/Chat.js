const { getConfig, setConfig, deleteConfig } = requireFromRoot("db");

const DIGITS = (s = "") => String(s).replace(/\D/g, "");

/** Normaliza: si un participante viene como @lid y trae .jid (real), usa el real */
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

/** ¿Es admin por NÚMERO? (sirve en LID y NO-LID) */
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
  try {
    const chatId   = msg.key.remoteJid;
    const isGroup  = chatId.endsWith("@g.us");
    const senderId = msg.key.participant || msg.key.remoteJid; // puede ser @lid
    const senderNo = DIGITS(senderId);
    const isBotMsg = !!msg.key.fromMe;

    if (!isGroup) {
      await conn.sendMessage(chatId, { text: "❌ Este comando solo se puede usar en grupos." }, { quoted: msg });
      return;
    }

    // ✅ Admin LID-aware
    const isAdmin = await isAdminByNumber(conn, chatId, senderNo);
    if (!isAdmin && !isBotMsg) {
      await conn.sendMessage(chatId, { text: "🚫 Solo los administradores del grupo pueden usar este comando." }, { quoted: msg });
      return;
    }

    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";
    const args   = body.trim().split(/\s+/).slice(1);
    const estado = (args[0] || "").toLowerCase();

    if (!["on", "off"].includes(estado)) {
      await conn.sendMessage(chatId, { text: "✳️ Usa correctamente:\n\n.chat on / off" }, { quoted: msg });
      return;
    }

    if (estado === "on") {
      setConfig(chatId, "chatgpt", 1);
    } else {
      deleteConfig(chatId, "chatgpt");
    }

    await conn.sendMessage(
      chatId,
      {
        text: `🤖 *ChatGPT* ha sido *${estado === "on" ? "activado" : "desactivado"}* en este grupo.`,
        react: { text: "✅", key: msg.key }
      },
      { quoted: msg }
    );

  } catch (err) {
    console.error("❌ Error en comando .chat:", err);
    await conn.sendMessage(msg.key.remoteJid, {
      text: "❌ Ocurrió un error al cambiar el estado de ChatGPT.",
      react: { text: "❌", key: msg.key }
    }, { quoted: msg });
  }
};

handler.command = ["chat"];
module.exports = handler;
