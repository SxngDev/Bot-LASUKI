const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = sender.replace(/[^0-9]/g, "");

  // 🛒 Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "🛍️", key: msg.key } });

  const input = args.join(" ");
  if (!input) {
    return conn.sendMessage(chatId, {
      text: "✳️ *Uso correcto:*\n.comprar <nombre/personaje o número>\n📌 Ej: *.comprar Sung_Jin-Woo* o *.comprar 1*",
      quoted: msg
    });
  }

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath)) : {};
  if (!db.usuarios) db.usuarios = [];
  if (!db.personajes) db.personajes = [];

  const user = db.usuarios.find(u => u.numero === numero);
  if (!user) {
    return conn.sendMessage(chatId, {
      text: "⚠️ No estás registrado. Usa *.rpg nombre apellido edad fechaNacimiento* para registrarte.",
      quoted: msg
    });
  }

  // 🧠 Detectar personaje
  let personaje;
  if (/^\d+$/.test(input)) {
    const index = parseInt(input) - 1;
    personaje = db.personajes[index];
  } else {
    const normalizado = input.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
    personaje = db.personajes.find(p =>
      p.nombre.toLowerCase().replace(/[^a-zA-Z0-9]/g, "") === normalizado
    );
  }

  if (!personaje) {
    return conn.sendMessage(chatId, {
      text: `❌ No se encontró ningún personaje con ese nombre o número.`,
      quoted: msg
    });
  }

  // 💸 Verificar saldo
  if (user.creditos < personaje.precio) {
    return conn.sendMessage(chatId, {
      text: `❌ No tienes suficientes créditos. Tu saldo actual es: *${user.creditos}* 💳`,
      quoted: msg
    });
  }

  // 💰 Descontar saldo y guardar personaje
  user.creditos -= personaje.precio;
  if (!user.personajes) user.personajes = [];
  user.personajes.push({
    nombre: personaje.nombre,
    imagen: personaje.imagen,
    precio: personaje.precio,
    nivel: personaje.nivel,
    habilidades: personaje.habilidades.map(h => ({ ...h }))
  });

  // ❌ Eliminar personaje de la tienda
  db.personajes = db.personajes.filter(p =>
    p.nombre.toLowerCase().replace(/[^a-zA-Z0-9]/g, "") !==
    personaje.nombre.toLowerCase().replace(/[^a-zA-Z0-9]/g, "")
  );

  fs.writeFileSync(sukirpgPath, JSON.stringify(db, null, 2));

  // 📷 Avatar fallback
  let avatarURL = "https://cdn.russellxz.click/f20c1249.jpeg";
  try {
    const pp = await conn.profilePictureUrl(sender, "image");
    if (pp) avatarURL = pp;
  } catch {}

  const fechaSolo = new Date().toLocaleDateString("es-AR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  // 🧾 Crear factura Canvas
  const canvas = createCanvas(800, 500);
  const ctx = canvas.getContext("2d");

  // Fondo
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Imagen personaje
  // Imagen del personaje (mover más abajo)
const personajeImg = await loadImage(personaje.imagen);
ctx.drawImage(personajeImg, 30, 170, 180, 260); // ← Aquí ajustamos el Y de 90 a 170

  // Avatar usuario (esquina superior izquierda)
  const avatar = await loadImage(avatarURL);
  ctx.save();
  ctx.beginPath();
  ctx.arc(60, 60, 40, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, 20, 20, 80, 80);
  ctx.restore();

  // Texto factura
  ctx.fillStyle = "#000";
  ctx.font = "bold 28px Sans-serif";
  ctx.fillText("❦ FACTURA DE COMPRA", 230, 50);

  ctx.font = "20px Sans-serif";
  ctx.fillText(`➤ Comprador: ${user.nombre} ${user.apellido}`, 230, 100);
  ctx.fillText(`➤ Edad: ${user.edad} años`, 230, 140);
  ctx.fillText(`➤ Fecha: ${fechaSolo}`, 230, 180);
  ctx.fillText(`➤ Personaje: ${personaje.nombre}`, 230, 220);
  ctx.fillText(`➤ Nivel: ${personaje.nivel}`, 230, 260);
  ctx.fillText(`➤ Habilidad 1: ${personaje.habilidades[0].nombre}`, 230, 300);
  ctx.fillText(`➤ Habilidad 2: ${personaje.habilidades[1].nombre}`, 230, 340);
  ctx.fillText(`➤ Precio: ${personaje.precio} créditos`, 230, 380);
  ctx.fillText(`➤ Saldo restante: ${user.creditos} créditos`, 230, 420);

  // ✅ Sello APROBADO
  ctx.fillStyle = "#28a745";
  ctx.font = "bold 36px Sans-serif";
  ctx.fillText("✔ COMPRA APROBADA", 330, 460); // Antes estaba en 480, ahora más a la izquierda
  const buffer = canvas.toBuffer("image/png");

  await conn.sendMessage(chatId, {
    image: buffer,
    caption: `✅ *usa .verper para ver los personajes que as comprado Has comprado exitosamente a ${personaje.nombre}*`,
    quoted: msg
  });

  await conn.sendMessage(chatId, {
    react: { text: "✅", key: msg.key }
  });
};

handler.command = ["comprar"];
module.exports = handler;
