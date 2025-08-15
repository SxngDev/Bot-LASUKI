// plugins/setdespedidas.js
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

const handler = async (msg, { conn, args, text }) => {
  const chatId    = msg.key.remoteJid;
  const isGroup   = chatId.endsWith("@g.us");
  const senderJid = msg.key.participant || msg.key.remoteJid; // puede ser @lid
  const senderNo  = DIGITS(senderJid);
  const isFromMe  = !!msg.key.fromMe;

  if (!isGroup) {
    await conn.sendMessage(chatId, { text: "❌ Este comando solo se puede usar en grupos." }, { quoted: msg });
    return;
  }

  // Permisos: admin/owner/bot (compatibles con LID)
  const isAdmin = await isAdminByNumber(conn, chatId, senderNo);

  // Owners (owner.json o global.owner)
  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath)
    ? JSON.parse(fs.readFileSync(ownerPath, "utf-8"))
    : (global.owner || []);
  const isOwner = Array.isArray(owners) && owners.some(([id]) => id === senderNo);

  if (!isAdmin && !isOwner && !isFromMe) {
    await conn.sendMessage(chatId, { text: "🚫 Solo los administradores pueden personalizar la despedida." }, { quoted: msg });
    return;
  }

  // Mensaje: usa `text` o `args` o texto citado
  let nuevo = (text || "").trim();
  if (!nuevo) nuevo = (args || []).join(" ").trim();
  if (!nuevo) nuevo = (getQuotedText(msg) || "").trim();

  if (!nuevo) {
    await conn.sendMessage(chatId, {
      text: "✳️ Usa:\n.setdespedidas <mensaje personalizado>\n\nEjemplo:\n.setdespedidas Adiós @user, te extrañaremos 💔\n\nTambién puedes responder a un mensaje con .setdespedidas"
    }, { quoted: msg });
    return;
  }

  // Guardar en setwelcome.json (preservando otras claves)
  const filePath = path.resolve("setwelcome.json");
  const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : {};
  if (!data[chatId]) data[chatId] = {};
  data[chatId].despedida = nuevo;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  await conn.sendMessage(chatId, { text: "✅ Mensaje de despedida personalizado guardado correctamente." }, { quoted: msg });
  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {});
};

handler.command = ["setdespedidas"];
module.exports = handler;
