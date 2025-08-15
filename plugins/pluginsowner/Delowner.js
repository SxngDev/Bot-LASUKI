const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args }) => {
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = sender.replace(/[^0-9]/g, "");
  const fromMe = msg.key.fromMe;

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "⏳", key: msg.key }
  });

  if (!global.isOwner(numero) && !fromMe) {
    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "❌", key: msg.key }
    });
    return conn.sendMessage(msg.key.remoteJid, {
      text: "🚫 Solo los owners pueden usar este comando."
    }, { quoted: msg });
  }

  // ➖ Obtener número por texto o cita
  let delNumber = args[0]?.replace(/\D/g, "");
  if (!delNumber && msg.message?.extendedTextMessage?.contextInfo?.participant) {
    delNumber = msg.message.extendedTextMessage.contextInfo.participant.replace(/\D/g, "");
  }

  if (!delNumber || delNumber === "15167096032") {
    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "❌", key: msg.key }
    });
    return conn.sendMessage(msg.key.remoteJid, {
      text: "⚠️ Número inválido o no se puede eliminar el owner principal."
    }, { quoted: msg });
  }

  const ruta = "./owner.json";
  let lista = JSON.parse(fs.readFileSync(ruta));
  const nuevaLista = lista.filter(([n]) => n !== delNumber);

  if (nuevaLista.length === lista.length) {
    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "❌", key: msg.key }
    });
    return conn.sendMessage(msg.key.remoteJid, {
      text: "⚠️ El número no estaba en la lista de owners."
    }, { quoted: msg });
  }

  fs.writeFileSync(ruta, JSON.stringify(nuevaLista, null, 2));
  global.owner = nuevaLista;

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "✅", key: msg.key }
  });

  return conn.sendMessage(msg.key.remoteJid, {
    text: `✅ Owner eliminado:\n➤ ${delNumber}`
  }, { quoted: msg });
};

handler.command = ["delowner"];
module.exports = handler;
