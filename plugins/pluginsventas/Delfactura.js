// plugins/delfactura.js
const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = (sender || "").replace(/\D/g, "");
  const fromMe = msg.key.fromMe;
  const botID = (conn.user?.id || "").replace(/\D/g, "");

  // Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "🗑️", key: msg.key } });

  // 🔒 Solo owners o el propio bot
  if (!global.isOwner(numero) && !fromMe && numero !== botID) {
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    return conn.sendMessage(chatId, {
      text: "🚫 Solo los owners o el mismo bot pueden usar este comando."
    }, { quoted: msg });
  }

  // Uso: .delfactura <numeroCliente> <servicio> [all]
  const numeroCliente = (args[0] || "").replace(/\D/g, "");
  const eliminarTodas = String(args[args.length - 1] || "").toLowerCase() === "all";
  const servicioEntrada = eliminarTodas ? args.slice(1, -1).join(" ") : args.slice(1).join(" ");
  const servicio = (servicioEntrada || "").toLowerCase().trim();

  if (!numeroCliente || !servicio) {
    return conn.sendMessage(chatId, {
      text:
`✳️ *Uso correcto:*
.${command} <numeroCliente> <servicio> [all]

📌 Ejemplos:
• .${command} 5219618719457 netflix
   (elimina la *más reciente* de ese cliente/servicio)
• .${command} 5219618719457 netflix all
   (elimina *todas* las facturas de ese cliente/servicio)`,
    }, { quoted: msg });
  }

  const filePath = path.join(process.cwd(), "facturas.json");
  if (!fs.existsSync(filePath)) {
    return conn.sendMessage(chatId, { text: "📂 Aún no existe *facturas.json*.", quoted: msg });
  }

  let db;
  try {
    db = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error("Error leyendo facturas.json:", e);
    return conn.sendMessage(chatId, { text: "❌ Error leyendo *facturas.json*.", quoted: msg });
  }
  db.facturas = Array.isArray(db.facturas) ? db.facturas : [];

  // 🔍 Normalización correcta según tu JSON (cliente.numero y servicio)
  const coincidenciasIdx = db.facturas
    .map((f, idx) => ({ f, idx }))
    .filter(({ f }) => {
      const numCli = String(f?.cliente?.numero || "").replace(/\D/g, "");
      const serv = String(f?.servicio || "").toLowerCase().trim();
      return numCli === numeroCliente && serv === servicio;
    });

  if (coincidenciasIdx.length === 0) {
    return conn.sendMessage(chatId, {
      text: `🔎 No encontré facturas para:\n• Cliente: *${numeroCliente}*\n• Servicio: *${servicio}*`,
      quoted: msg
    });
  }

  // 🗑️ Eliminar
  const eliminadas = [];
  if (eliminarTodas) {
    // Eliminar todas (índices de mayor a menor)
    coincidenciasIdx.sort((a, b) => b.idx - a.idx).forEach(({ f, idx }) => {
      eliminadas.push(f);
      db.facturas.splice(idx, 1);
    });
  } else {
    // Eliminar SOLO la más reciente por fechaCreacion
    const masReciente = coincidenciasIdx
      .slice()
      .sort((a, b) => {
        const aT = Number(new Date(a.f.fechaCreacion || 0));
        const bT = Number(new Date(b.f.fechaCreacion || 0));
        return bT - aT;
      })[0];

    eliminadas.push(masReciente.f);
    db.facturas.splice(masReciente.idx, 1);
  }

  // Guardar cambios
  try {
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("Error guardando facturas.json:", e);
    return conn.sendMessage(chatId, { text: "❌ Error guardando cambios en *facturas.json*.", quoted: msg });
  }

  // ✅ Resumen
  const borradas = eliminadas.length;
  const ids = eliminadas.map(x => x.id || "(sin id)").join(", ");
  const quedan = coincidenciasIdx.length - borradas;

  const texto = eliminarTodas
    ? `✅ *${borradas} factura(s) eliminada(s)* para:\n• Cliente: *${numeroCliente}*\n• Servicio: *${servicio}*\n\n🧾 Id(s) borrado(s): ${ids}`
    : `✅ *Factura eliminada* (más reciente) para:\n• Cliente: *${numeroCliente}*\n• Servicio: *${servicio}*\n\n🧾 Id borrado: ${ids}\n🔁 Coincidencias restantes: *${Math.max(0, quedan)}*\n\n💡 Para eliminar todas:\n.${command} ${numeroCliente} ${servicio} all`;

  await conn.sendMessage(chatId, { text: texto }, { quoted: msg });
  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["delfactura"];
module.exports = handler;
