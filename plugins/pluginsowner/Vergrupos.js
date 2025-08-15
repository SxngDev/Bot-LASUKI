const fs = require("fs");
const path = require("path");
const { getAllConfigs, getConfig } = requireFromRoot("db");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNum = sender.replace(/[^0-9]/g, "");
  const isOwner = global.owner.some(([id]) => id === senderNum);

  if (!isOwner) {
    await conn.sendMessage(chatId, {
      text: "⛔ Este comando solo puede usarlo el *dueño del bot*."
    }, { quoted: msg });
    return;
  }

  // ✅ Reacciona de una vez al comando
  await conn.sendMessage(chatId, {
    react: { text: "📄", key: msg.key }
  });

  // 🌐 Estado del modoPrivado global
  const modoPrivadoGlobal = (await getConfig("global", "modoprivado")) == 1 ? "✅" : "❌";

  const groups = await conn.groupFetchAllParticipating();
  const configKeys = [
    ["antis", "🚫 Antis"],
    ["antidelete", "🗑️ Antidelete"],
    ["modoprivado", "🔒 ModoPrivado"],
    ["apagado", "🛑 Apagado"],
    ["modoadmins", "👮‍♂️ Solo Admins"],
    ["antiarabe", "🚷 AntiArabe"],
    ["antilink", "🔗 AntiLink WA"],
    ["linkall", "🌐 AntiLink All"],
    ["welcome", "👋 Bienvenida"],
    ["despedidas", "👋 Despedida"]
  ];

  const resultLines = [];

  for (const [id, data] of Object.entries(groups)) {
    const name = data.subject || "Sin nombre";
    const config = getAllConfigs(id);
    const stateLines = configKeys.map(([k, label]) => {
      const active = config[k] == 1 ? "✅" : "❌";
      return `${label.padEnd(16)}: ${active}`;
    }).join("\n");

    let link = "🔒 No soy admin";
    try {
      const code = await conn.groupInviteCode(id);
      link = `https://chat.whatsapp.com/${code}`;
    } catch {}

    resultLines.push(`╭───────────────
📛 *${name}*
🔗 *Enlace:* ${link}
${stateLines}
╰───────────────\n`);
  }

  const listado = resultLines.length
    ? resultLines.join("\n")
    : "❌ No se encontraron grupos activos.";

  const replyText = `🌐 *Modo Privado Global:* ${modoPrivadoGlobal}\n\n📋 *Listado de grupos y sus configuraciones:*\n\n${listado}`;

  await conn.sendMessage(chatId, {
    text: replyText
  }, { quoted: msg });
};

handler.command = ["vergrupos"];
module.exports = handler;
