const fs = require("fs");
const path = require("path");

const PAUSA_MS = 3000;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function normName(s = "") {
  return String(s).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const numero = (sender || "").replace(/\D/g, "");
  const fromMe = msg.key.fromMe;
  const botID = (conn.user?.id || "").replace(/\D/g, "");

  // Reacción inicial
  await conn.sendMessage(chatId, { react: { text: "🐾", key: msg.key } });

  // Solo owners o el propio bot
  if (!global.isOwner(numero) && !fromMe && numero !== botID) {
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    return conn.sendMessage(chatId, {
      text: "🚫 Solo los owners o el mismo bot pueden usar este comando."
    }, { quoted: msg });
  }

  // Texto crudo (acepta multi-línea)
  const raw =
    msg.message?.extendedTextMessage?.text?.trim() ??
    msg.message?.conversation?.trim() ??
    args.join(" ").trim();

  // Separar por el token 🔥addmascota (case-insensitive)
  const partes = raw.split(/🔥addmascota/i)
    .map(s => s.trim())
    .filter(Boolean);

  if (partes.length === 0) {
    return conn.sendMessage(chatId, {
      text:
`✳️ *Uso (multi-agregado):*
.addmascota2 🔥addmascota 🐈‍⬛Gato Sigilo_nocturno Agilidad_felina https://cdn.dorratz.com/files/1740556714815.jpg 82000
             🔥addmascota 🐕Perro Lealtad_inquebrantable Olfato_agudo https://cdn.dorratz.com/files/1740556752843.jpg 72500
             🔥addmascota 🐓Gallo Canto_de_guerra Picotazo_rápido https://cdn.dorratz.com/files/1740556819807.jpg 71800

📌 Formato de cada bloque:
🔥addmascota <Nombre> <Habilidad1> <Habilidad2> <ImagenURL> <Precio>

• Usa _ para espacios en nombres/habilidades.
• Se valida y evita duplicados por nombre.`,
    }, { quoted: msg });
  }

  // Cargar DB
  const dbPath = path.join(process.cwd(), "sukirpg.json");
  let db = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf-8")) : {};
  db.mascotas = Array.isArray(db.mascotas) ? db.mascotas : [];

  // Índice de duplicados por nombre normalizado
  const nombresSet = new Set(db.mascotas.map(m => normName(m.nombre)));

  let agregadas = 0, saltadas = 0, errores = 0;

  for (const bloque of partes) {
    // Tokenizar por espacios (Nombre, Hab1, Hab2, URL, Precio)
    // Nota: los guiones bajos sirven como “espacios visuales”
    const tokens = bloque.split(/\s+/).filter(Boolean);

    if (tokens.length < 5) {
      errores++;
      await conn.sendMessage(chatId, {
        text: `⚠️ Bloque ignorado (faltan datos):\n${bloque}`,
      }, { quoted: msg });
      continue;
    }

    const [nombre, hab1, hab2, imagen, precioStr] = tokens;
    const precio = parseInt(precioStr, 10);

    if (!/^https?:\/\//i.test(imagen)) {
      errores++;
      await conn.sendMessage(chatId, {
        text: `⚠️ Imagen inválida para *${nombre}*. Debe ser URL http/https.`,
      }, { quoted: msg });
      continue;
    }
    if (isNaN(precio) || precio <= 0) {
      errores++;
      await conn.sendMessage(chatId, {
        text: `⚠️ Precio inválido para *${nombre}*.`,
      }, { quoted: msg });
      continue;
    }

    const clave = normName(nombre);
    if (nombresSet.has(clave)) {
      saltadas++;
      await conn.sendMessage(chatId, {
        text: `⚠️ La mascota *${nombre.replace(/_/g, " ")}* ya existe. Saltando.`,
      }, { quoted: msg });
      continue;
    }

    // Construir mascota
    const mascota = {
      nombre,
      imagen,
      precio,
      nivel: 1,
      habilidades: [
        { nombre: hab1, nivel: 1 },
        { nombre: hab2, nivel: 1 }
      ]
    };

    // Guardar
    db.mascotas.push(mascota);
    nombresSet.add(clave);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    // Feedback con imagen
    const caption =
`✅ *Mascota agregada a la tienda*
🐶 *Nombre:* ${nombre.replace(/_/g, " ")}
💳 *Precio:* ${precio} créditos
📈 *Nivel:* 1
🦴 *Habilidad 1:* ${hab1.replace(/_/g, " ")} (Nv 1)
🐾 *Habilidad 2:* ${hab2.replace(/_/g, " ")} (Nv 1)`;

    try {
      await conn.sendMessage(chatId, { image: { url: imagen }, caption }, { quoted: msg });
    } catch {
      await conn.sendMessage(chatId, { text: caption }, { quoted: msg });
    }

    agregadas++;
    await sleep(PAUSA_MS); // pausa entre mascotas
  }

  await conn.sendMessage(chatId, {
    text: `📦 *Resumen addmascota2*\n• Agregadas: ${agregadas}\n• Duplicadas: ${saltadas}\n• Errores: ${errores}`
  }, { quoted: msg });

  await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
};

handler.command = ["addmascota2", "addmas2"];
module.exports = handler;
