const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = sender.replace(/[^0-9]/g, "");

  await conn.sendMessage(chatId, { react: { text: "🔄", key: msg.key } });

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  const db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath)) : {};
  db.usuarios = db.usuarios || [];

  const usuario = db.usuarios.find(u => u.numero === numero);
  if (!usuario || !usuario.mascotas || usuario.mascotas.length === 0) {
    return conn.sendMessage(chatId, {
      text: "❌ No tienes mascotas registradas. Usa `.rpg` o `.comprarmas` para obtener una.",
      quoted: msg
    });
  }

  // Mostrar lista de mascotas si no se pasó argumento
  if (args.length === 0) {
    let lista = `🐾 *Tus mascotas disponibles:*\n\n`;
    usuario.mascotas.forEach((m, i) => {
      lista += `*${i + 1}.* ${m.nombre} (Nivel ${m.nivel})\n`;
    });
    lista += `\n✳️ Usa:\n.mascota número o nombre de la mascota\n📌 Ej:\n• .mascota 2\n• .mascota firulais`;
    return conn.sendMessage(chatId, {
      text: lista,
      quoted: msg
    });
  }

  const arg = args.join(" ").toLowerCase().replace(/[^a-z0-9]/gi, "");
  let index = -1;

  if (!isNaN(arg)) {
    const pos = parseInt(arg) - 1;
    if (pos >= 0 && pos < usuario.mascotas.length) index = pos;
  } else {
    index = usuario.mascotas.findIndex(m =>
      m.nombre.toLowerCase().replace(/[^a-z0-9]/gi, "") === arg
    );
  }

  if (index === -1) {
    return conn.sendMessage(chatId, {
      text: "❌ Mascota no encontrada. Asegúrate de escribir bien el nombre o número correcto.",
      quoted: msg
    });
  }

  if (index === 0) {
    return conn.sendMessage(chatId, {
      text: `⚠️ *${usuario.mascotas[0].nombre}* ya es tu mascota principal.`,
      quoted: msg
    });
  }

  const seleccionada = usuario.mascotas.splice(index, 1)[0];
  usuario.mascotas.unshift(seleccionada);

  fs.writeFileSync(sukirpgPath, JSON.stringify(db, null, 2));

  await conn.sendMessage(chatId, {
    text: `✅ Ahora tu mascota principal es *${seleccionada.nombre}*.`,
    quoted: msg
  });

  await conn.sendMessage(chatId, {
    react: { text: "🐾", key: msg.key }
  });
};

handler.command = ["mascota"];
module.exports = handler;
