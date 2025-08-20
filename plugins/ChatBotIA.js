const { getConfig, setConfig, deleteConfig } = requireFromRoot("db");
const OpenAI = require("openai");

// Configuración de la API de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // 👈 pon tu API key aquí
});

// Memoria de conversaciones (en memoria RAM)
const memoria = {}; // { chatId: [ {role, content}, ... ] }

/** Extrae solo los números de un ID */
const DIGITS = (s = "") => String(s).replace(/\D/g, "");

/** Normaliza IDs LID */
function lidParser(participants = []) {
  return participants.map(v => ({
    id: (typeof v?.id === "string" && v.id.endsWith("@lid") && v.jid) ? v.jid : v.id,
    admin: v?.admin ?? null,
    raw: v
  }));
}

/** Verifica si un número es admin */
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

/** Función que llama a ChatGPT */
async function responderIA(chatId, mensaje) {
  if (!memoria[chatId]) memoria[chatId] = [];

  memoria[chatId].push({ role: "user", content: mensaje });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini", // rápido y barato
    messages: [
      { role: "system", content: "Responde como un humano normal en WhatsApp: breve, natural y amigable. Nunca digas que eres un bot." },
      ...memoria[chatId]
    ]
  });

  const respuesta = completion.choices[0].message.content;

  memoria[chatId].push({ role: "assistant", content: respuesta });

  return respuesta;
}

/** Handler principal */
const handler = async (msg, { conn }) => {
  try {
    const chatId   = msg.key.remoteJid;
    const isGroup  = chatId.endsWith("@g.us");
    const senderId = msg.key.participant || msg.key.remoteJid;
    const senderNo = DIGITS(senderId);
    const isBotMsg = !!msg.key.fromMe;

    // Solo funciona en grupos
    if (!isGroup) return;

    // Leer configuración (si el chat está activado)
    const cfg = getConfig(chatId, "chatgpt");

    // Si el mensaje es el comando ".chat"
    const body = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || "";
    const args   = body.trim().split(/\s+/);
    const comando = args[0]?.toLowerCase();
    const estado  = (args[1] || "").toLowerCase();

    if (comando === ".chat") {
      const isAdmin = await isAdminByNumber(conn, chatId, senderNo);
      if (!isAdmin && !isBotMsg) {
        await conn.sendMessage(chatId, { text: "🚫 Solo administradores pueden activar/desactivar el chat." }, { quoted: msg });
        return;
      }

      if (!["on", "off"].includes(estado)) {
        await conn.sendMessage(chatId, { text: "✳️ Usa:\n\n.chat on / .chat off" }, { quoted: msg });
        return;
      }

      if (estado === "on") {
        setConfig(chatId, "chatgpt", 1);
        await conn.sendMessage(chatId, { text: "🤖 ChatGPT ha sido *activado* en este grupo ✅" }, { quoted: msg });
      } else {
        deleteConfig(chatId, "chatgpt");
        delete memoria[chatId]; // borrar historial del grupo
        await conn.sendMessage(chatId, { text: "🤖 ChatGPT ha sido *desactivado* en este grupo ❌" }, { quoted: msg });
      }
      return;
    }

    // Si no está activado, ignorar
    if (!cfg) return;

    // Ignorar mensajes del propio bot
    if (isBotMsg) return;

    // Si está activado → responder con IA
    const texto = body.trim();
    if (!texto) return;

    const reply = await responderIA(chatId, texto);

    await conn.sendMessage(chatId, { text: reply }, { quoted: msg });

  } catch (err) {
    console.error("❌ Error en comando .chat:", err);
  }
};

handler.command = ["chat"];
module.exports = handler;
