const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = (sender || "").replace(/[^0-9]/g, "");
  const fromMe = msg.key.fromMe;
  const botID = (conn.user?.id || "").replace(/[^0-9]/g, "");

  // Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "🏦", key: msg.key } });

  // 🔒 Owner / Bot
  if (!global.isOwner(numero) && !fromMe && numero !== botID) {
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    return conn.sendMessage(chatId, {
      text: "🚫 Solo los owners o el mismo bot pueden usar este comando."
    }, { quoted: msg });
  }

  // 📌 Validación
  if (args.length < 2) {
    return conn.sendMessage(chatId, {
      text: `✳️ *Uso correcto:*\n.addbank <monto> <tiempo>\n\n📌 Ejemplos:\n• .addbank 30000 1m (1 minuto)\n• .addbank 50000 2h (2 horas)\n• .addbank 100000 24h (24 horas)`,
      quoted: msg
    });
  }

  const monto = parseInt(args[0]);
  const tiempoInput = String(args[1] || "").toLowerCase().trim();

  if (isNaN(monto) || monto <= 0) {
    return conn.sendMessage(chatId, {
      text: "❌ El monto debe ser un número válido mayor a 0.",
      quoted: msg
    });
  }

  // ⏳ Convertir tiempo
  const match = tiempoInput.match(/^(\d+)([mh])$/i);
  if (!match) {
    return conn.sendMessage(chatId, {
      text: "❌ El tiempo debe especificarse en minutos (m) o horas (h).\nEj: 1m, 2h, 24h",
      quoted: msg
    });
  }

  const valor = parseInt(match[1]);
  const unidad = match[2].toLowerCase();
  const tiempoMS = unidad === "m" ? valor * 60 * 1000 : valor * 60 * 60 * 1000;

  // 📂 Guardar configuración del banco
  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(sukirpgPath) ? JSON.parse(fs.readFileSync(sukirpgPath)) : {};

  // Preservar préstamos activos si ya existían
  const prestamosActivos = db?.banco?.prestamos || [];

  if (!db.banco) db.banco = {};

  db.banco = {
    // Capital disponible del banco para prestar
    montoTotal: monto,
    // Config del plazo que usará .prestamo para calcular fechaLimite = Date.now() + tiempoLimiteMs
    plazo: {
      valor,            // 1, 2, 24, etc.
      unidad,           // "m" o "h"
      ms: tiempoMS,     // milisegundos del plazo
      texto: tiempoInput
    },
    // Tasa base que puede usar el sistema de cobro (por defecto 20%)
    tasaInteres: typeof db.banco.tasaInteres === "number" ? db.banco.tasaInteres : 0.20,
    // Frecuencia sugerida de cobro (puede leerla el checker si querés centralizar)
    frecuenciaCobroMs: db.banco.frecuenciaCobroMs || (30 * 60 * 1000),
    // Lista de préstamos activos
    prestamos: prestamosActivos
  };

  fs.writeFileSync(sukirpgPath, JSON.stringify(db, null, 2));

  // ✅ Confirmación
  await conn.sendMessage(chatId, {
    text:
`🏦 *Banco configurado correctamente*
💳 *Capital disponible:* ${monto} créditos
⏳ *Plazo por préstamo:* ${valor}${unidad} (${tiempoMS.toLocaleString()} ms)
📈 *Tasa interés base:* ${(db.banco.tasaInteres * 100).toFixed(0)}%
🔁 *Frecuencia sugerida de cobro:* ${db.banco.frecuenciaCobroMs / 60000} min

ℹ️ *Nota:* El comando *.prestamo* debe usar este plazo para calcular *fechaLimite = Date.now() + db.banco.plazo.ms*.`,
    quoted: msg
  });

  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["addbank"];
module.exports = handler;
