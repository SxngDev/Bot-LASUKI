const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args }) => {
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = sender.replace(/[^0-9]/g, "");
  const fromMe = msg.key.fromMe;

  // ⏳ Reacción inicial
  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "⏳", key: msg.key }
  });

  // 🚫 Validación: owner o bot mismo
  if (!global.isOwner(numero) && !fromMe) {
    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "❌", key: msg.key }
    });
    return conn.sendMessage(msg.key.remoteJid, {
      text: "🚫 Este comando solo puede usarlo un Owner o el mismo bot."
    }, { quoted: msg });
  }

  const ruta = path.resolve("./prefijos.json");

  if (!args[0]) {
    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "❌", key: msg.key }
    });
    return conn.sendMessage(msg.key.remoteJid, {
      text: `✳️ Uso correcto:\n.setprefix [ "." , "🐱", "#" ]\n.setprefix 🤖`
    }, { quoted: msg });
  }

  let nuevosPrefijos;

  try {
    if (args.join(" ").startsWith("[")) {
      nuevosPrefijos = JSON.parse(args.join(" ").trim());
      if (!Array.isArray(nuevosPrefijos) || nuevosPrefijos.some(p => typeof p !== "string" || p.length === 0)) throw new Error();
    } else {
      nuevosPrefijos = [args.join(" ")]; // acepta emojis largos o combinaciones
    }
  } catch (e) {
    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "❌", key: msg.key }
    });
    return conn.sendMessage(msg.key.remoteJid, {
      text: "⚠️ Prefijo inválido.\nEjemplos válidos:\n.setprefix [ \".\" , \"#\" , \"💀\" ]\n.setprefix 🤖"
    }, { quoted: msg });
  }

  fs.writeFileSync(ruta, JSON.stringify(nuevosPrefijos, null, 2));
  global.prefixes = nuevosPrefijos;

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "✅", key: msg.key }
  });

  return conn.sendMessage(msg.key.remoteJid, {
    text: `✅ Prefijo(s) actualizado(s):\n${nuevosPrefijos.map(p => `➤ ${p}`).join("\n")}`
  }, { quoted: msg });
};

handler.command = ["setprefix"];
module.exports = handler;
