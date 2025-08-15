const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = sender.replace(/\D/g, "");

  await conn.sendMessage(chatId, { react: { text: "💰", key: msg.key } });

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath)) : {};
  db.usuarios = db.usuarios || [];
  db.personajes_venta = db.personajes_venta || [];

  const usuario = db.usuarios.find(u => u.numero === numero);
  if (!usuario || !usuario.personajes || usuario.personajes.length === 0) {
    return conn.sendMessage(chatId, {
      text: "❌ No tienes personajes disponibles para vender.",
      quoted: msg
    });
  }

  if (args.length < 2) {
    return conn.sendMessage(chatId, {
      text: `✳️ *Uso correcto:*\n.vender númeroPersonaje precio\n📌 Ej:\n• .vender 2 30000\n• .vender goku 20000`,
      quoted: msg
    });
  }

  const arg = args[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const precioVenta = parseInt(args[1]);

  if (isNaN(precioVenta) || precioVenta < 1) {
    return conn.sendMessage(chatId, {
      text: "❌ Debes escribir un precio válido para la venta.",
      quoted: msg
    });
  }

  let index = -1;
  if (!isNaN(arg)) {
    const idx = parseInt(arg) - 1;
    if (usuario.personajes[idx]) index = idx;
  } else {
    index = usuario.personajes.findIndex(p =>
      p.nombre.toLowerCase().replace(/[^a-z0-9]/g, "") === arg
    );
  }

  if (index === -1) {
    return conn.sendMessage(chatId, {
      text: "❌ No se encontró el personaje que quieres vender.",
      quoted: msg
    });
  }

  const personaje = usuario.personajes.splice(index, 1)[0];

  db.personajes_venta.push({
    nombre: personaje.nombre,
    imagen: personaje.imagen,
    precio_original: personaje.precio,
    precio_venta: precioVenta,
    nivel: personaje.nivel,
    habilidades: personaje.habilidades,
    vendedor: {
      numero,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      edad: usuario.edad,
      nivel: usuario.nivel
    }
  });

  fs.writeFileSync(sukirpgPath, JSON.stringify(db, null, 2));

  await conn.sendMessage(chatId, {
    image: { url: personaje.imagen },
    caption: `✅ *${personaje.nombre}* fue puesto a la venta exitosamente por *${precioVenta} créditos*.\n\n✨ Usa el comando *.alaventa* para ver todos los personajes en venta por otros usuarios. si deseas quitar la Venta usa el comando: *.QUITARVENTA*`,
    quoted: msg
  });

  await conn.sendMessage(chatId, {
    react: { text: "🛒", key: msg.key }
  });
};

handler.command = ["vender"];
module.exports = handler;
