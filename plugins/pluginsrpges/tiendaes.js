// plugins/tiendaesclavos.js
// Comando: .tiendaesclavos / .tiendaes
// Muestra información de ganancias, esclavos reclamados (agrupados por dueño) y esclavos disponibles.

const fs = require("fs");
const path = require("path");

const MENU_URL = "https://cdn.russellxz.click/27293a78.jpeg";

const PRECIOS = {
  1: 25000,
  2: 50000,
  3: 75000,
  4: 100000,
  5: 125000
};

const RETORNOS = {
  1: [35000, 40000],
  2: [60000, 65000],
  3: [85000, 90000],
  4: [110000, 115000],
  5: [135000, 140000]
};

function cargarDB(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
}

function formatoTiempo(msRestante) {
  if (!Number.isFinite(msRestante) || msRestante <= 0) return "⏳ Terminado";
  const s = Math.floor(msRestante / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const partes = [];
  if (d) partes.push(`${d}d`);
  if (h) partes.push(`${h}h`);
  if (m) partes.push(`${m}m`);
  partes.push(`${sec}s`);
  return partes.join(" ");
}

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = (sender || "").replace(/\D/g, "");

  await conn.sendMessage(chatId, { react: { text: "🛒", key: msg.key } });

  const sukirpgPath = path.join(process.cwd(), "sukirpg.json");
  const db = cargarDB(sukirpgPath);

  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
  db.esclavos = Array.isArray(db.esclavos) ? db.esclavos : [];

  if (!db.usuarios.length) {
    return conn.sendMessage(chatId, { text: "📭 No hay usuarios registrados aún.", quoted: msg });
  }

  const ahora = Date.now();

  const activoPorEsclavo = new Map();
  for (const c of db.esclavos) {
    const slave = String(c.objetivo || c.slave || "");
    const owner = String(c.dueno || c.owner || "");
    const hasta = Number(c.hasta || c.fin || 0);
    if (!slave || !owner || !hasta) continue;
    if (hasta > ahora && !c.escapado) {
      const prev = activoPorEsclavo.get(slave);
      if (!prev || hasta > prev.hasta) {
        activoPorEsclavo.set(slave, { owner, hasta, dias: Number(c.dias || 0) });
      }
    }
  }

  const disponibles = [];
  const comprados = [];

  for (const u of db.usuarios) {
    const num = String(u.numero || "");
    if (!num) continue;
    const estado = activoPorEsclavo.get(num);
    if (estado) {
      comprados.push({ slave: num, owner: estado.owner, hasta: estado.hasta });
    } else {
      if (num !== numero) disponibles.push(num);
    }
  }

  disponibles.sort();
  comprados.sort((a, b) => a.hasta - b.hasta);

  // Agrupar por dueño
  const grupos = {};
  comprados.forEach(c => {
    if (!grupos[c.owner]) grupos[c.owner] = [];
    grupos[c.owner].push(c);
  });

  let caption = `🛒 *TIENDA DE ESCLAVOS*\n`;
  caption += `👤 Solicitado por: @${numero}\n`;
  caption += `────────────────────\n`;

  caption += `💵 *Precios y retorno total estimado (por contrato):*\n`;
  for (let d = 1; d <= 5; d++) {
    caption += `• ${d} día(s) → Precio *${PRECIOS[d].toLocaleString()}* | Retorno *${RETORNOS[d][0].toLocaleString()}–${RETORNOS[d][1].toLocaleString()}*\n`;
  }

  caption += `\n⏱ *¿Cada cuánto paga?*\n`;
  caption += `El sistema reparte pequeñas recompensas periódicas durante todo el contrato.\n\n`;

  caption += `🧾 *Cómo comprar*\n`;
  caption += `• Responde al usuario: *.comprares <dias>*\n`;
  caption += `• O menciónalo: *.comprares <dias> @usuario*\n`;
  caption += `Ejemplos:\n`;
  caption += `• *.comprares 1* (respondiendo)\n`;
  caption += `• *.comprares 2 @1234567890*\n`;
  caption += `\n💡 Usa *.veres* o *.veresclavos* para ver cómo van trabajando tus esclavos.\n`;

  caption += `\n────────────────────\n`;
  caption += `🔒 *ESCLAVOS RECLAMADOS*\n`;
  if (comprados.length) {
    let i = 1;
    for (const owner in grupos) {
      caption += `👑 Dueño: @${owner}\n`;
      grupos[owner].forEach(c => {
        const restante = formatoTiempo(c.hasta - ahora);
        caption += `   ${i++}. @${c.slave} → ⏳ ${restante}\n`;
      });
      caption += `────────────────────\n`;
    }
  } else {
    caption += `No hay esclavos reclamados.\n`;
  }

  caption += `\n✅ *ESCLAVOS DISPONIBLES*\n`;
  if (disponibles.length) {
    disponibles.forEach((n, i) => {
      caption += `${i + 1}. @${n}\n`;
    });
  } else {
    caption += `No hay esclavos disponibles.\n`;
  }

  const mentions = new Set([`${numero}@s.whatsapp.net`]);
  for (const n of disponibles) mentions.add(`${n}@s.whatsapp.net`);
  for (const c of comprados) {
    mentions.add(`${c.slave}@s.whatsapp.net`);
    mentions.add(`${c.owner}@s.whatsapp.net`);
  }

  await conn.sendMessage(chatId, {
    image: { url: MENU_URL },
    caption,
    mentions: Array.from(mentions)
  }, { quoted: msg });

  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["tiendaesclavos", "tiendaes"];
module.exports = handler;
