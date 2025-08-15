// plugins/comprarbank.js
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const normaliza = s => String(s || "")
  .toLowerCase()
  .replace(/[^a-z0-9]/gi, "");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = (sender || "").replace(/\D/g, "");

  // 🛒 Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "🛍️", key: msg.key } });

  const input = (args || []).join(" ").trim();
  if (!input) {
    return conn.sendMessage(chatId, {
      text: "✳️ *Uso correcto:*\n.comprarbank <número|nombre>\n📌 Ej: *.comprarbank 1* o *.comprarbank goku*",
      quoted: msg
    });
  }

  // Cargar DB
  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath, "utf-8")) : {};
  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
  db.banco = db.banco || {};
  db.banco.tiendaPersonajesBanco = Array.isArray(db.banco.tiendaPersonajesBanco) ? db.banco.tiendaPersonajesBanco : [];
  db.banco.montoTotal = Number(db.banco.montoTotal) || 0;

  const user = db.usuarios.find(u => u.numero === numero);
  if (!user) {
    return conn.sendMessage(chatId, {
      text: "⚠️ No estás registrado. Usa *.rpg nombre apellido edad fechaNacimiento* para registrarte.",
      quoted: msg
    });
  }

  // Seleccionar personaje desde la tienda del banco
  let pj = null;
  const tienda = db.banco.tiendaPersonajesBanco;

  if (/^\d+$/.test(input)) {
    const idx = parseInt(input, 10) - 1;
    if (idx >= 0 && idx < tienda.length) pj = tienda[idx];
  } else {
    const buscado = normaliza(input);
    pj = tienda.find(p => normaliza(p.nombre) === buscado);
  }

  if (!pj) {
    return conn.sendMessage(chatId, {
      text: "❌ No se encontró ningún personaje en la *Tienda del Banco* con ese número o nombre.",
      quoted: msg
    });
  }

  const precioVenta = Number(pj.precio_venta) || 0;
  const precioOriginal = Number(pj.precio_original) || precioVenta;

  // 💸 Verificar saldo
  if ((user.creditos || 0) < precioVenta) {
    return conn.sendMessage(chatId, {
      text: `❌ No tienes suficientes créditos.\n💳 Te faltan *${precioVenta - (user.creditos || 0)}* créditos.`,
      quoted: msg
    });
  }

  // Cobrar al comprador y acreditar al banco
  user.creditos = (user.creditos || 0) - precioVenta;
  db.banco.montoTotal += precioVenta;

  // Guardar en cartera del usuario con *precio original* (por si regresa a tienda oficial)
  if (!Array.isArray(user.personajes)) user.personajes = [];
  user.personajes.push({
    nombre: pj.nombre,
    imagen: pj.imagen,
    precio: precioOriginal,        // ← se guarda el precio original
    nivel: Number(pj.nivel) || 1,
    habilidades: (pj.habilidades || []).map(h => ({ ...h }))
  });

  // Quitar de la tienda del banco
  db.banco.tiendaPersonajesBanco = tienda.filter(x =>
    normaliza(x.nombre) !== normaliza(pj.nombre)
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

  // 🧾 Factura Canvas (simple)
  try {
    const canvas = createCanvas(800, 500);
    const ctx = canvas.getContext("2d");

    // Fondo
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Imagen personaje
    const personajeImg = await loadImage(pj.imagen);
    ctx.drawImage(personajeImg, 30, 170, 180, 260);

    // Avatar usuario
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
    ctx.fillText("❦ FACTURA DE COMPRA (Banco)", 200, 50);

    ctx.font = "20px Sans-serif";
    ctx.fillText(`➤ Comprador: ${user.nombre} ${user.apellido}`, 230, 100);
    ctx.fillText(`➤ Fecha: ${fechaSolo}`, 230, 130);
    ctx.fillText(`➤ Personaje: ${pj.nombre}`, 230, 170);
    ctx.fillText(`➤ Nivel: ${pj.nivel}`, 230, 200);
    const h1 = pj.habilidades?.[0]?.nombre || "-";
    const h2 = pj.habilidades?.[1]?.nombre || "-";
    ctx.fillText(`➤ Habilidad 1: ${h1}`, 230, 230);
    ctx.fillText(`➤ Habilidad 2: ${h2}`, 230, 260);
    ctx.fillText(`➤ Precio pagado (banco): ${precioVenta} créditos`, 230, 300);
    ctx.fillText(`➤ Saldo restante: ${user.creditos} créditos`, 230, 330);

    // Sello
    ctx.fillStyle = "#28a745";
    ctx.font = "bold 36px Sans-serif";
    ctx.fillText("✔ COMPRA APROBADA", 300, 460);

    const buffer = canvas.toBuffer("image/png");

    await conn.sendMessage(chatId, {
      image: buffer,
      caption: `✅ *Has comprado exitosamente a ${pj.nombre} (Banco)*\n\nUsa *.verper* para ver tus personajes.`,
      quoted: msg
    });
  } catch {
    // Fallback texto si canvas falla
    await conn.sendMessage(chatId, {
      text:
        `✅ Compra realizada (Banco)\n` +
        `• Personaje: *${pj.nombre}*\n` +
        `• Nivel: *${pj.nivel}*\n` +
        `• Habilidades: ${(pj.habilidades||[]).map(h=>h?.nombre).filter(Boolean).join(" | ") || "-" }\n` +
        `• Precio pagado: *${precioVenta}* créditos\n` +
        `• Saldo restante: *${user.creditos}* créditos\n\n` +
        `Usa *.verper* para ver tus personajes.`,
      quoted: msg
    });
  }

  // Reacción final
  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["comprarbank"];
module.exports = handler;
