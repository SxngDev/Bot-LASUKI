const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = sender.replace(/\D/g, "");

  await conn.sendMessage(chatId, { react: { text: "🛍️", key: msg.key } });

  const input = args.join(" ");
  if (!input) {
    return conn.sendMessage(chatId, {
      text: "✳️ *Uso correcto:*\n.comprar2 <nombre o número>\n📌 Ej: .comprar2 goku o .comprar2 1",
      quoted: msg
    });
  }

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  const db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath)) : {};
  db.usuarios = db.usuarios || [];
  db.personajes_venta = db.personajes_venta || [];

  const comprador = db.usuarios.find(u => u.numero === numero);
  if (!comprador) {
    return conn.sendMessage(chatId, {
      text: "❌ No estás registrado. Usa `.rpg nombre apellido edad fechaNacimiento`.",
      quoted: msg
    });
  }

  let personaje = null;

  if (/^\d+$/.test(input)) {
    const idx = parseInt(input) - 1;
    if (idx >= 0 && idx < db.personajes_venta.length) {
      personaje = db.personajes_venta[idx];
    }
  } else {
    const normalizado = input.toLowerCase().replace(/[^a-z0-9]/g, "");
    personaje = db.personajes_venta.find(p =>
      p.nombre.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizado
    );
  }

  if (!personaje) {
    return conn.sendMessage(chatId, {
      text: "❌ No se encontró ningún personaje a la venta con ese nombre o número.",
      quoted: msg
    });
  }

  if (personaje.vendedor.numero === numero) {
    return conn.sendMessage(chatId, {
      text: "🚫 No puedes comprar un personaje que tú mismo pusiste a la venta.",
      quoted: msg
    });
  }

  if (comprador.creditos < personaje.precio_venta) {
    return conn.sendMessage(chatId, {
      text: `❌ No tienes suficientes créditos.\n💳 Te faltan *${personaje.precio_venta - comprador.creditos}* créditos.`,
      quoted: msg
    });
  }

  // Descontar créditos del comprador
  comprador.creditos -= personaje.precio_venta;

  // Dar créditos al vendedor
  const vendedor = db.usuarios.find(u => u.numero === personaje.vendedor.numero);
  if (vendedor) vendedor.creditos += personaje.precio_venta;

  // Agregar personaje al comprador con precio original
  comprador.personajes = comprador.personajes || [];
  comprador.personajes.push({
    nombre: personaje.nombre,
    imagen: personaje.imagen,
    precio: personaje.precio_original,
    nivel: personaje.nivel,
    habilidades: personaje.habilidades.map(h => ({ ...h }))
  });

  // Eliminar personaje de la tienda de venta
  db.personajes_venta = db.personajes_venta.filter(p =>
    p.nombre.toLowerCase().replace(/[^a-z0-9]/g, "") !==
    personaje.nombre.toLowerCase().replace(/[^a-z0-9]/g, "")
  );

  fs.writeFileSync(sukirpgPath, JSON.stringify(db, null, 2));

  await conn.sendMessage(chatId, {
    image: { url: personaje.imagen },
    caption: `✅ *Has comprado exitosamente a ${personaje.nombre}*\n\n🎯 *Nivel:* ${personaje.nivel}\n✨ *Habilidades:*\n• ${personaje.habilidades[0].nombre}\n• ${personaje.habilidades[1].nombre}\n\n💳 *Créditos pagados:* ${personaje.precio_venta}\n👤 *Vendedor:* ${personaje.vendedor.nombre} ${personaje.vendedor.apellido} (${personaje.vendedor.edad} años)\n\nUsa *.verper* para ver tus personajes.`,
    quoted: msg
  });

  await conn.sendMessage(chatId, {
    react: { text: "✅", key: msg.key }
  });
};

handler.command = ["comprar2"];
module.exports = handler;
