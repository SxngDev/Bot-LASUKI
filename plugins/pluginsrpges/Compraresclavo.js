// plugins/compraresclavo.js
// .comprares <1..5> respondiendo o mencionando
// Alinea nextRewardAt a bucket (~2min) para que caigan juntas las recompensas.

const fs = require("fs");
const path = require("path");

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_TICK_MS = 2 * 60 * 1000; // mismo que el watcher (modo test)
const JITTER_MS_MAX = 30 * 1000;

const PRECIOS = { 1: 25000, 2: 50000, 3: 75000, 4: 100000, 5: 125000 };
const RANGOS_RECOMPENSA = {
  1: [35000, 40000], 2: [60000, 65000], 3: [85000, 90000],
  4: [110000, 115000], 5: [135000, 140000]
};

function cargarDB(p){ return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p,"utf8")) : {}; }
function guardarDB(p,o){ fs.writeFileSync(p, JSON.stringify(o,null,2)); }

function limpiarContratosVencidos(db, ahora){
  db.esclavos = Array.isArray(db.esclavos)? db.esclavos : [];
  let cambios = false;
  for (let i=db.esclavos.length-1;i>=0;i--){
    const c = db.esclavos[i];
    if (Number(c.hasta) <= ahora || c.escapado) {
      const target = db.usuarios?.find(u => String(u.numero) === String(c.objetivo || c.slave));
      if (target && String(target.esclavoDe||"") === String(c.dueno || c.owner)) {
        delete target.esclavoDe; delete target.esclavitud; cambios = true;
      }
      db.esclavos.splice(i,1); cambios = true;
    }
  }
  return cambios;
}

function formatoTiempo(ms){
  if (!Number.isFinite(ms) || ms<=0) return "⏳ Terminado";
  const s = Math.floor(ms/1000);
  const d = Math.floor(s/86400);
  const h = Math.floor((s%86400)/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec || (!d && !h && !m)) parts.push(`${sec}s`);
  return parts.join(" ");
}

// Alinea al próximo bucket común (para que varios caigan juntos)
function nextAlignedTick() {
  const t = Date.now();
  const bucket = Math.ceil((t + 1) / BASE_TICK_MS) * BASE_TICK_MS;
  const jitter = Math.floor(Math.random() * JITTER_MS_MAX);
  return bucket + jitter;
}

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const compradorNum = (sender || "").replace(/\D/g, "");

  await conn.sendMessage(chatId, { react: { text: "🧾", key: msg.key } });

  const dias = parseInt(args?.[0],10);
  if (![1,2,3,4,5].includes(dias)) {
    return conn.sendMessage(chatId, {
      text: "✳️ Uso: *.comprares <1|2|3|4|5>* respondiendo o mencionando al usuario.\nEj: *.comprares 2 @user*",
      quoted: msg
    });
  }

  // detectar objetivo
  let objetivoNum = null;
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (ctx?.participant) objetivoNum = ctx.participant.replace(/\D/g,"");
  else if (ctx?.mentionedJid?.length) objetivoNum = ctx.mentionedJid[0].replace(/\D/g,"");

  if (!objetivoNum) return conn.sendMessage(chatId, { text: "❌ Debes responder o mencionar al usuario que quieres comprar.", quoted: msg });
  if (objetivoNum === compradorNum) return conn.sendMessage(chatId, { text: "❌ No puedes comprarte a ti mismo.", quoted: msg });

  const file = path.join(process.cwd(), "sukirpg.json");
  const db = cargarDB(file);
  db.usuarios = Array.isArray(db.usuarios)? db.usuarios: [];
  db.esclavos = Array.isArray(db.esclavos)? db.esclavos: [];

  const comprador = db.usuarios.find(u => String(u.numero)===compradorNum);
  const objetivo  = db.usuarios.find(u => String(u.numero)===objetivoNum);
  if (!comprador) return conn.sendMessage(chatId, { text: "❌ No estás registrado. Usa `.rpg nombre apellido edad fechaNacimiento`.", quoted: msg });
  if (!objetivo)  return conn.sendMessage(chatId, { text: "❌ El usuario objetivo no está registrado.", quoted: msg });

  // 🚫 Bloquear compra si el comprador tiene deuda activa en el banco
  if (db.banco && Array.isArray(db.banco.prestamos)) {
    const deudaActiva = db.banco.prestamos
      .filter(p => String(p.numero) === String(compradorNum) && p.estado === "activo" && Number(p.pendiente || 0) > 0)
      .reduce((sum, p) => sum + Number(p.pendiente || 0), 0);
    if (deudaActiva > 0) {
      return conn.sendMessage(chatId, {
        text: `🚫 No puedes comprar esclavos mientras tengas deuda activa en el banco.\n💰 Deuda pendiente: *${deudaActiva.toLocaleString("es-ES")}* créditos.\n📌 Paga con *.pagarall*.`,
        quoted: msg
      });
    }
  }

  const ahora = Date.now();
  if (limpiarContratosVencidos(db, ahora)) guardarDB(file, db);

  // no comprar a tu dueño actual
  if (objetivoNum === comprador?.esclavoDe) {
    return conn.sendMessage(chatId, { text: "🚫 Eres esclavo de esa persona ahora mismo. No puedes comprar a tu propio dueño.", quoted: msg });
  }
  if (comprador?.esclavitud?.dueno) {
    const d = String(comprador.esclavitud.dueno||"");
    const f = Number(comprador.esclavitud.hasta||0);
    if (d === String(objetivoNum) && f > ahora) {
      return conn.sendMessage(chatId, { text: "🚫 Eres esclavo de ese usuario actualmente. No puedes comprar a tu propio dueño.", quoted: msg });
    }
  }

  // ya comprado por otro?
  const activoObj = db.esclavos.find(c => String(c.objetivo)===objetivoNum && Number(c.hasta)>ahora);
  if (activoObj && String(activoObj.dueno)!==String(compradorNum)) {
    const rest = formatoTiempo(activoObj.hasta - ahora);
    return conn.sendMessage(chatId, {
      text: `🚫 Este usuario ya tiene dueño.\n👤 Dueño: @${activoObj.dueno}\n⏳ Restante: ${rest}`,
      mentions: [`${activoObj.dueno}@s.whatsapp.net`],
      quoted: msg
    });
  }

  const precio = PRECIOS[dias];
  const saldo = Number(comprador.creditos||0);
  if (saldo < precio) {
    return conn.sendMessage(chatId, { text: `❌ Saldo insuficiente. Precio ${dias} día(s): *${precio}*.\nTu saldo: *${saldo}*`, quoted: msg });
  }

  // cobrar
  comprador.creditos = saldo - precio;

  // extender si ya es tu esclavo
  let propio = db.esclavos.find(c =>
    String(c.dueno)===String(compradorNum) &&
    String(c.objetivo)===String(objetivoNum) &&
    Number(c.hasta)>ahora
  );

  const extraMs = dias * DAY_MS;
  const nextAligned = nextAlignedTick();

  if (propio) {
    propio.hasta = Number(propio.hasta) + extraMs;
    propio.dias  = Number(propio.dias || 0) + dias;
    propio.precio= Number(propio.precio || 0) + precio;
    propio.origenChat = propio.origenChat || chatId;

    propio.owner = propio.owner || compradorNum;
    propio.slave = propio.slave || objetivoNum;
    propio.inicio = propio.inicio || propio.desde || ahora;
    propio.fin = Number(propio.fin || propio.hasta);

    // Alinear su próximo pago al bucket común
    propio.nextRewardAt = nextAligned;
  } else {
    const desde = ahora;
    const hasta = desde + extraMs;
    db.esclavos.push({
      id: `${compradorNum}_${objetivoNum}_${desde}`,
      dueno: compradorNum,
      objetivo: objetivoNum,

      owner: compradorNum,
      slave: objetivoNum,
      inicio: desde,
      fin: hasta,

      desde, hasta, dias, precio,
      nextRewardAt: nextAligned,  // ← clave para agrupar
      origenChat: chatId
    });
  }

  // marcar estado en objetivo
  const final = db.esclavos.find(c =>
    String(c.dueno)===String(compradorNum) &&
    String(c.objetivo)===String(objetivoNum) &&
    Number(c.hasta) > ahora
  );
  if (final) {
    objetivo.esclavoDe = compradorNum;
    objetivo.esclavitud = { dueno: compradorNum, desde: Number(final.desde), hasta: Number(final.hasta), dias: Number(final.dias) };
  }

  guardarDB(file, db);

  const restTxt = final ? formatoTiempo(Number(final.hasta) - ahora) : formatoTiempo(extraMs);
  await conn.sendMessage(chatId, {
    text:
`✅ *${propio ? "Extensión aplicada" : "Compra realizada con éxito"}*
👑 Dueño: @${compradorNum}
🔗 Esclavo: @${objetivoNum}

⏱ *${propio ? "Tiempo añadido" : "Duración"}:* ${dias} día(s)
💵 *Costo:* ${precio} créditos
🧾 *Tu saldo ahora:* ${comprador.creditos} créditos
⏳ *Tiempo restante del contrato:* ${restTxt}

🧭 Próximos comandos:
• *.veres* / *.veresclavos* → ver tus esclavos y tiempo hasta la *siguiente recompensa*.
• *.tiendaes* / *.tiendaesclavo* → listar usuarios disponibles.`,
    mentions: [`${compradorNum}@s.whatsapp.net`, `${objetivoNum}@s.whatsapp.net`],
    quoted: msg
  });

  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["compraresclavo","comprares"];
module.exports = handler;
