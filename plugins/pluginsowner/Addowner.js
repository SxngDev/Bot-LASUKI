
const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args }) => {
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = sender.replace(/[^0-9]/g, "");
  const fromMe = msg.key.fromMe;
  const botID = (conn.user?.id || "").replace(/[^0-9]/g, "");

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "⏳", key: msg.key }
  });

  if (!global.isOwner(numero) && !fromMe && numero !== botID) {
    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "❌", key: msg.key }
    });
    return conn.sendMessage(msg.key.remoteJid, {
      text: "🚫 Solo los owners o el mismo bot pueden usar este comando."
    }, { quoted: msg });
  }

  // ➕ Obtener número por texto o cita
  let newNumber = args[0]?.replace(/\D/g, "");
  if (!newNumber && msg.message?.extendedTextMessage?.contextInfo?.participant) {
    newNumber = msg.message.extendedTextMessage.contextInfo.participant.replace(/\D/g, "");
  }

  if (!newNumber) {
    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "❌", key: msg.key }
    });
    return conn.sendMessage(msg.key.remoteJid, {
      text: "⚠️ Usa:\n.addowner 549xxxx o cita un mensaje."
    }, { quoted: msg });
  }

  const ruta = "./owner.json";
  const lista = JSON.parse(fs.readFileSync(ruta));
  if (lista.some(([n]) => n === newNumber)) {
    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "❌", key: msg.key }
    });
    return conn.sendMessage(msg.key.remoteJid, {
      text: `⚠️ El número ya es owner.`
    }, { quoted: msg });
  }

  lista.push([newNumber]);
  fs.writeFileSync(ruta, JSON.stringify(lista, null, 2));
  global.owner = lista;

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "✅", key: msg.key }
  });

  return conn.sendMessage(msg.key.remoteJid, {
    text: `✅ Owner agregado:\n➤ ${newNumber}`
  }, { quoted: msg });
};

handler.command = ["addowner"];
module.exports = handler;
