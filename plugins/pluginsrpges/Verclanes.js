// plugins/verclanes.js
// Comando: .verclanes / .verclan
// - Envía la imagen del Clan Supremo (si existe) con caption (citando).
// - Luego envía UN SOLO listado enumerado de todos los clanes (Supremo #1), citando.
// - Muestra: nivel, bodega, líder, #miembros, nivel mínimo, e instrucción: .unirme <número>

const fs = require("fs");
const path = require("path");

function loadDB(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
}
function num(n) {
  return Number(n || 0).toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  const file = path.join(process.cwd(), "sukirpg.json");
  const db = loadDB(file);
  db.clanes = Array.isArray(db.clanes) ? db.clanes : [];
  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];

  if (!db.clanes.length) {
    return conn.sendMessage(chatId, { text: "📭 Aún no hay clanes creados." }, { quoted: msg });
  }

  // Orden: supremo primero, resto por fecha de creación
  const supremo = db.clanes.find(c => c.esSupremo);
  const otros = db.clanes
    .filter(c => !c.esSupremo)
    .sort((a, b) => Number(a.creadoEn || 0) - Number(b.creadoEn || 0));

  const ordered = [];
  if (supremo) ordered.push(supremo);
  ordered.push(...otros);

  // --- 1) Imagen + caption del Clan Supremo (si existe bannerUrl) ---
  if (supremo) {
    const miembrosCount = Array.isArray(supremo.miembros) ? supremo.miembros.length : 0;
    const liderStr = supremo.lider
      ? (supremo.lider.numero === "BOT"
          ? "La Suki Bot"
          : (supremo.lider.numero ? `@${supremo.lider.numero}` : (supremo.lider.nombre || "—")))
      : "—";

    const captionSup =
      `👑 *CLAN REY* (#1)\n` +
      `🏷️ Nombre: *${supremo.nombre}*\n` +
      `🎚️ Nivel: *${num(supremo.nivelClan || 1)}*\n` +
      `🧰 Bodega: *${num(supremo.bodegaCreditos || 0)}* créditos\n` +
      `🧑‍✈️ Líder: ${liderStr}\n` +
      `👥 Miembros: *${miembrosCount}*\n` +
      `🎯 Nivel mínimo para unirse: *${supremo.minNivelParaUnirse || 1}*\n` +
      `📌 Para unirte usa: *.unirme 1*`;

    const supMentions = [];
    if (supremo.lider && supremo.lider.numero && supremo.lider.numero !== "BOT") {
      supMentions.push(`${supremo.lider.numero}@s.whatsapp.net`);
    }

    if (supremo.bannerUrl) {
      try {
        await conn.sendMessage(
          chatId,
          {
            image: { url: supremo.bannerUrl },
            caption: captionSup,
            mentions: supMentions
          },
          { quoted: msg } // ← cita SIEMPRE
        );
      } catch {
        // Fallback a texto si falla la imagen
        await conn.sendMessage(
          chatId,
          { text: captionSup, mentions: supMentions },
          { quoted: msg }
        );
      }
    } else {
      await conn.sendMessage(
        chatId,
        { text: captionSup, mentions: supMentions },
        { quoted: msg }
      );
    }
  }

  // --- 2) Un solo listado enumerado (Supremo #1) ---
  const raya = "────────────────";
  let texto = "🏰 *LISTA DE CLANES*\n";
  texto += "Usa: *.unirme <número>*  (ej: *.unirme 1*)\n";
  texto += `${raya}\n`;

  const mentions = new Set();

  ordered.forEach((c, idx) => {
    const n = idx + 1; // enumeración
    const miembrosCount = Array.isArray(c.miembros) ? c.miembros.length : 0;

    let liderStr = "—";
    if (c.lider) {
      if (c.lider.numero === "BOT") {
        liderStr = "La Suki Bot";
      } else if (c.lider.numero) {
        liderStr = `@${c.lider.numero}`;
        mentions.add(`${c.lider.numero}@s.whatsapp.net`);
      } else if (c.lider.nombre) {
        liderStr = c.lider.nombre;
      }
    }

    texto += `*${n}) ${c.esSupremo ? "👑 (SUPREMO) " : ""}${c.nombre}*\n`;
    texto += `🎚️ Nivel: *${num(c.nivelClan || 1)}*\n`;
    texto += `🧰 Bodega: *${num(c.bodegaCreditos || 0)}* créditos\n`;
    texto += `🧑‍✈️ Líder: ${liderStr}\n`;
    texto += `👥 Miembros: *${miembrosCount}*\n`;
    texto += `🎯 Nivel mínimo para unirse: *${c.minNivelParaUnirse || 1}*\n`;
    texto += `📌 Para unirte: *.unirme ${n}*\n`;
    if (idx !== ordered.length - 1) texto += `${raya}\n`;
  });

  await conn.sendMessage(
    chatId,
    { text: texto.trim(), mentions: Array.from(mentions) },
    { quoted: msg } // ← también cita aquí
  );
};

handler.command = ["verclanes", "verclan"];
module.exports = handler;
