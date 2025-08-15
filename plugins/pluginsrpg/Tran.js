// plugins/transferir.js
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

// ⏳ igual que en banco
function formatoTiempo(msRestante) {
  if (!Number.isFinite(msRestante) || msRestante <= 0) return "⏳ Tiempo vencido";
  const s = Math.floor(msRestante / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const partes = [];
  if (d) partes.push(`${d}d`);
  if (h) partes.push(`${h}h`);
  if (m) partes.push(`${m}m`);
  if (sec && !d && !h) partes.push(`${sec}s`);
  return partes.join(" ");
}

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numeroSender = (sender || "").replace(/\D/g, "");

  await conn.sendMessage(chatId, { react: { text: "💸", key: msg.key } });

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  const db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath)) : {};
  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
  db.banco = db.banco || null;

  const remitente = db.usuarios.find(u => u.numero === numeroSender);
  if (!remitente) {
    return conn.sendMessage(chatId, { text: "❌ No estás registrado en el RPG.", quoted: msg });
  }

  // === Detectar receptor y monto (respuesta o mención) ===
  let receptorNumero;
  let cantidad;

  if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
    receptorNumero = msg.message.extendedTextMessage.contextInfo.participant.replace(/\D/g, "");
    cantidad = parseInt(args[0], 10);
  } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    receptorNumero = msg.message.extendedTextMessage.contextInfo.mentionedJid[0].replace(/\D/g, "");
    cantidad = parseInt(args[1], 10);
  } else {
    return conn.sendMessage(chatId, {
      text: "✳️ Uso:\n• Responde al usuario: *.transferir <monto>*\n• O menciona al usuario: *.transferir @user <monto>*",
      quoted: msg
    });
  }

  if (!receptorNumero) {
    return conn.sendMessage(chatId, { text: "❌ No se pudo detectar el receptor.", quoted: msg });
  }
  if (receptorNumero === numeroSender) {
    return conn.sendMessage(chatId, { text: "❌ No puedes transferirte a ti mismo.", quoted: msg });
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return conn.sendMessage(chatId, { text: "❌ Ingresa una cantidad válida mayor que 0.", quoted: msg });
  }

  // === Bloqueo por deuda activa (con fecha y cuenta regresiva) ===
  if (db.banco && Array.isArray(db.banco.prestamos)) {
    const prestamoActivo = db.banco.prestamos.find(p => String(p.numero) === numeroSender && p.estado === "activo");
    const pendiente = Number(prestamoActivo?.pendiente || 0);
    if (prestamoActivo && pendiente > 0) {
      const ahora = Date.now();
      const venceMs = Number(prestamoActivo.fechaLimite || 0);
      const tiempoRestante = formatoTiempo(venceMs - ahora);
      const venceTxt = venceMs ? new Date(venceMs).toLocaleString() : "—";

      // ⚠️ CITA el mensaje del usuario
      return conn.sendMessage(chatId, {
        text:
`🚫 *No puedes transferir: tienes una deuda activa con el banco.*

😒 *“No pagas tu deuda y ya quieres transferir… mala paga.”*
🏦 *El Banco de La Suki* te espera con tu pago.

🧮 *Deuda pendiente:* ${pendiente} créditos
📅 *Fecha límite:* ${venceTxt}
⏳ *Tiempo restante:* ${tiempoRestante}

📌 Paga con: *.pagarall*`,
        quoted: msg
      });
    }
  }

  // === Verificar receptor ===
  const receptor = db.usuarios.find(u => u.numero === receptorNumero);
  if (!receptor) {
    return conn.sendMessage(chatId, { text: "❌ El usuario receptor no está registrado.", quoted: msg });
  }

  // === Saldo disponible (solo “afuera”) ===
  const saldoDisponible = Number(remitente.creditos || 0);
  if (saldoDisponible < cantidad) {
    return conn.sendMessage(chatId, {
      text: `❌ No tienes créditos suficientes. Tu saldo actual es *${saldoDisponible}* 💳`,
      quoted: msg
    });
  }

  // === Ejecutar transferencia ===
  remitente.creditos = saldoDisponible - cantidad;
  receptor.creditos = (receptor.creditos || 0) + cantidad;

  fs.writeFileSync(sukirpgPath, JSON.stringify(db, null, 2));

  // === Factura visual ===
  const fecha = new Date().toLocaleDateString("es-AR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const canvas = createCanvas(900, 500);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 900, 500);

  const logo = await loadImage("https://cdn.russellxz.click/9f08a046.jpeg");
  ctx.save();
  ctx.beginPath();
  ctx.arc(80, 80, 60, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(logo, 20, 20, 120, 120);
  ctx.restore();

  ctx.fillStyle = "#000";
  ctx.font = "bold 32px Sans-serif";
  ctx.fillText("❦FACTURA DE TRANSFERENCIA❦", 180, 60);

  ctx.font = "20px Sans-serif";
  ctx.fillText(`☛ Fecha: ${fecha}`, 180, 100);
  ctx.fillText(`☛ Remitente: ${remitente.nombre} ${remitente.apellido}`, 180, 140);
  ctx.fillText(`☛ Saldo después: ${remitente.creditos}`, 180, 170);
  ctx.fillText(`☛ Receptor: ${receptor.nombre} ${receptor.apellido}`, 180, 210);
  ctx.fillText(`☛ Saldo después: ${receptor.creditos}`, 180, 240);
  ctx.fillText(`☛ Cantidad Transferida: ${cantidad} créditos`, 180, 280);

  ctx.fillStyle = "#28a745";
  ctx.font = "bold 40px Sans-serif";
  ctx.fillText("✔ TRANSFERENCIA EXITOSA", 165, 350);

  const buffer = canvas.toBuffer("image/png");

  await conn.sendMessage(chatId, {
    image: buffer,
    caption: `✅ Transferencia realizada.\n💸 *${remitente.nombre}* → *${receptor.nombre}*`,
    quoted: msg // también citamos el mensaje original en la confirmación
  });

  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["transferir", "tran"];
module.exports = handler;
