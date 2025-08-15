const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = sender.replace(/[^0-9]/g, "");

  await conn.sendMessage(chatId, { react: { text: "🏦", key: msg.key } });

  const amount = parseInt(args[0]);
  if (isNaN(amount) || amount <= 0) {
    return conn.sendMessage(chatId, {
      text: "⚠️ Debes indicar una cantidad válida para retirar.\nEj: *.retirar 200*",
      quoted: msg
    });
  }

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath)) : {};
  if (!db.usuarios) db.usuarios = [];

  const user = db.usuarios.find(u => u.numero === numero);
  if (!user) {
    return conn.sendMessage(chatId, {
      text: "⚠️ No estás registrado. Usa *.rpg nombre apellido edad fechaNacimiento* para registrarte.",
      quoted: msg
    });
  }

  if (user.guardado < amount) {
    return conn.sendMessage(chatId, {
      text: `❌ No tienes suficientes créditos guardados. Tu saldo guardado es: *${user.guardado}* 💼`,
      quoted: msg
    });
  }

  // Actualizar saldo
  user.guardado -= amount;
  user.creditos += amount;
  fs.writeFileSync(sukirpgPath, JSON.stringify(db, null, 2));

  // Obtener avatar
  let avatarURL = "https://cdn.russellxz.click/f20c1249.jpeg";
  try {
    const pp = await conn.profilePictureUrl(sender, "image");
    if (pp) avatarURL = pp;
  } catch {}

  const fechaSolo = new Date().toLocaleDateString("es-AR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  // Crear factura Canvas
  const canvas = createCanvas(800, 500);
  const ctx = canvas.getContext("2d");

  // Fondo
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Avatar
  const avatar = await loadImage(avatarURL);
  ctx.save();
  ctx.beginPath();
  ctx.arc(90, 90, 60, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, 30, 30, 120, 120);
  ctx.restore();

  // Título
  ctx.fillStyle = "#000";
  ctx.font = "bold 30px Sans-serif";
  ctx.fillText("❦ COMPROBANTE DE RETIRO", 200, 60);

  // Datos
  ctx.fillStyle = "#000";
  ctx.font = "20px Sans-serif";
  ctx.fillText(`➢ Nombre: ${user.nombre} ${user.apellido}`, 50, 190);
  ctx.fillText(`➢ Edad: ${user.edad} años`, 50, 230);
  ctx.fillText(`➢ Fecha: ${fechaSolo}`, 50, 270);
  ctx.fillText(`➢ Cantidad retirada: ${amount} créditos`, 50, 310);
  ctx.fillText(`➢ Saldo actual: ${user.creditos} créditos`, 50, 350);
  ctx.fillText(`➢ Saldo total guardado: ${user.guardado} créditos`, 50, 390);

  // Sello
  ctx.fillStyle = "#28a745";
  ctx.font = "bold 38px Sans-serif";
  ctx.fillText("✔ APROBADO", 480, 460);

  const buffer = canvas.toBuffer("image/png");

  await conn.sendMessage(chatId, {
    image: buffer,
    caption: `✅ *Retiro realizado correctamente usa: .saldo para ver mas detalles*\n\n🧾 Tu factura de retiro está lista.`,
    quoted: msg
  });

  await conn.sendMessage(chatId, {
    react: { text: "✅", key: msg.key }
  });
};

handler.command = ["retirar", "ret"];
module.exports = handler;
