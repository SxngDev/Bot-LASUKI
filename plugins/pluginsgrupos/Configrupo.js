const fs = require("fs");
const path = require("path");
const { getAllConfigs } = requireFromRoot("db");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  if (!chatId.endsWith("@g.us")) {
    await conn.sendMessage(chatId, {
      text: "❌ *Este comando solo funciona en grupos.*"
    }, { quoted: msg });
    return;
  }

  await conn.sendMessage(chatId, {
    react: { text: "📋", key: msg.key }
  });

  const metadata = await conn.groupMetadata(chatId);
  const name = metadata.subject || "Sin nombre";
  const creator = metadata.owner?.split("@")[0] || "Desconocido";
  const fecha = metadata.creation
    ? new Date(metadata.creation * 1000).toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : "No disponible";

  const config = getAllConfigs(chatId);
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

  const stateLines = configKeys.map(([k, label]) => {
    const active = config[k] == 1 ? "✅" : "❌";
    return `${label.padEnd(16)}: ${active}`;
  }).join("\n");

  const resultText = `📋 *Configuraciones del Grupo:*
📛 *Nombre:* ${name}
🧑‍💼 *Creador:* @${creator}
📆 *Fecha de creación:* ${fecha}

${stateLines}`;

  await conn.sendMessage(chatId, {
    text: resultText,
    mentions: [`${creator}@s.whatsapp.net`]
  }, { quoted: msg });
};

handler.command = ["configrupo"];
module.exports = handler;
