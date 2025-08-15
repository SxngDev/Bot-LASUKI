// plugins/verfactura.js
const fs = require("fs");
const path = require("path");

function formatearTiempoRestante(ms) {
  if (ms <= 0) return "0s";
  let segundos = Math.floor(ms / 1000);
  let dias = Math.floor(segundos / 86400);
  segundos %= 86400;
  let horas = Math.floor(segundos / 3600);
  segundos %= 3600;
  let minutos = Math.floor(segundos / 60);
  segundos %= 60;
  let partes = [];
  if (dias > 0) partes.push(`${dias}d`);
  if (horas > 0) partes.push(`${horas}h`);
  if (minutos > 0) partes.push(`${minutos}m`);
  if (segundos > 0) partes.push(`${segundos}s`);
  return partes.join(" ");
}

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  await conn.sendMessage(chatId, { react: { text: "📄", key: msg.key } });

  const filePath = path.join(process.cwd(), "facturas.json");
  if (!fs.existsSync(filePath)) {
    return conn.sendMessage(chatId, { text: "📂 No hay facturas registradas aún.", quoted: msg });
  }

  let db;
  try {
    db = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error("❌ Error leyendo facturas.json:", err);
    return conn.sendMessage(chatId, { text: "❌ Error al leer las facturas.", quoted: msg });
  }

  if (!Array.isArray(db.facturas) || db.facturas.length === 0) {
    return conn.sendMessage(chatId, { text: "📂 No hay facturas registradas aún.", quoted: msg });
  }

  let texto = `🧾 *LISTA DE FACTURAS*\n\n`;
  const ahora = Date.now();

  db.facturas.forEach((factura, i) => {
    let estado = factura.estado;
    let tiempoRestante = factura.fechaProximoPago - ahora;

    if (tiempoRestante <= 0) {
      estado = "no pagado";
      tiempoRestante = 0;
    }

    texto += `📌 *Factura #${i + 1}*\n`;
    texto += `🆔 ID: ${factura.id}\n`;
    texto += `💼 Servicio: ${factura.servicio}\n`;
    texto += `💰 Precio: ${factura.precio}\n`;
    texto += `🔄 Ciclo: ${factura.ciclo?.texto || "-"}\n`;
    texto += `📅 Creada: ${new Date(factura.fechaCreacion).toLocaleString()}\n`;
    texto += `📅 Próximo pago: ${new Date(factura.fechaProximoPago).toLocaleString()}\n`;
    texto += `⏳ Tiempo restante: ${formatearTiempoRestante(tiempoRestante)}\n`;
    texto += `📊 Estado: ${estado.toUpperCase()}\n\n`;
    texto += `👤 Cliente: ${factura.cliente?.nombre} (${factura.cliente?.numero})\n`;
    texto += `🛒 Vendedor: ${factura.vendedor?.nombre} (${factura.vendedor?.numero})\n`;
    texto += `──────────────\n\n`;
  });

  await conn.sendMessage(chatId, { text: texto.trim(), quoted: msg });
  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["verfactura", "verfac"];
module.exports = handler;
