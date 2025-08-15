
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");
const { getConfig } = requireFromRoot("db");
// Cache global de admins por chat
const adminCache = {};

const handler = async (conn) => {
  conn.ev.on("group-participants.update", async (update) => {
    try {
      const chatId = update.id;
      const isGroup = chatId.endsWith("@g.us");
      if (!isGroup) return;
//bueno
if (!adminCache[chatId]) {
  const oldMeta = await conn.groupMetadata(chatId);
  adminCache[chatId] = new Set(
    oldMeta.participants
      .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
      .map(p => p.id)
  );
}
//ok      
      const welcomeActive = await getConfig(chatId, "welcome");
      const byeActive = await getConfig(chatId, "despedidas");
      const antiArabe = await getConfig(chatId, "antiarabe");

      const setwelcomePath = path.resolve("setwelcome.json");
      const personalizados = fs.existsSync(setwelcomePath)
        ? JSON.parse(fs.readFileSync(setwelcomePath, "utf-8"))[chatId] || {}
        : {};

      const bienvenidaPersonalizada = personalizados?.bienvenida;
      const despedidaPersonalizada = personalizados?.despedida;

      const mensajesBienvenida = [
        "🌟 ¡Bienvenid@ al grupo! Esperamos que la pases de lo mejor 🎉",
        "🎈 ¡Hola hola! Gracias por unirte, disfruta tu estadía✨️",
        "✨ ¡Nuevo miembro ha llegado! Que empiece la fiesta 🎊",
        "😯 ¡Hey! Te damos la bienvenida con los brazos abiertos🤗",
        "💥 ¡Un guerrero más se une a la aventura! Bienvenid@ 😎"
      ];

      const mensajesDespedida = [
        "😈 ¡Adiós! Esperamos de nuevo.",
        "😆 Se ha ido un miembro. ¡Buena suerte!",
        "🚪 Alguien ha salido del grupo. ¡Hasta luego!",
        "📤 Un compañero ha partido, ¡le deseamos lo mejor!",
        "💨 Se ha ido volando... ¡Bye bye!"
      ];

      const arabes = [
        "20", "212", "213", "216", "218", "222", "224", "230", "234", "235", "237", "238", "249",
        "250", "251", "252", "253", "254", "255", "257", "258", "260", "263", "269", "960", "961",
        "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973", "974", "975",
        "976", "980", "981", "992", "994", "995", "998"
      ];

      const metadata = await conn.groupMetadata(chatId);

// 🔒 INICIO SISTEMA DE PROTECCIÓN Y AVISO DE CAMBIOS DE ADMIN 🔒

const botId     = conn.user.id.split(':')[0] + '@s.whatsapp.net';
const configPath = path.resolve('setwelcome.json');
const data      = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  : {};

// 1) Lista blanca: los JID aquí NO sufrirán ningún castigo
const whiteList = data.lista || [];

// 2) Preparamos el blacklist por chat
data[chatId] = data[chatId] || {};
data[chatId].blacklistAdmins = data[chatId].blacklistAdmins || {};
const blacklist = data[chatId].blacklistAdmins;

// 3) CASTIGO POR DEMOTE (quita permisos de admin)
if (update.action === 'demote' && update.participants?.length) {
  const actor  = update.author;
  const target = update.participants[0];

  if (whiteList.includes(actor)) return; // si está exento, nada que hacer

  if (actor && target && actor !== target && actor !== botId) {
    // 3.1) Guardar castigo de 24h
    const now = Date.now();
    blacklist[actor] = now + 24 * 60 * 60 * 1000;
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));

    // 3.2) Quitarle admin
    await conn.groupParticipantsUpdate(chatId, [actor], 'demote').catch(() => {});

    // 3.3) Notificar con explicación de /addlista
    await conn.sendMessage(chatId, {
      text: `
🚨 *VIOLACIÓN DE POLÍTICA DE ADMINISTRACIÓN*

⚠️ El admin @${actor.split('@')[0]} quitó permisos de admin a @${target.split('@')[0]}.

🕒 Su rol ha sido revocado por *24 horas*.

🔰 Para eximir a un admin de este sistema de castigo, usa *\/addlista @usuario*.
🧯 Para restaurar este admin antes de tiempo, usa *\/restpro @${actor.split('@')[0]}*.
      `.trim(),
      mentions: [actor, target]
    });
  }
}

// 4) CASTIGO POR REMOVE (expulsión de admin del grupo)
if (update.action === 'remove' && update.participants?.length) {
  const actor  = update.author;
  const target = update.participants[0];

  // 4.0 Si el actor está exento, ni siquiera intentamos castigar
  if (whiteList.includes(actor)) {
    // pero NO return; —> dejamos seguir para despedidas
  } else if (
    actor && target &&
    actor !== target &&
    actor !== botId
  ) {
    // 4.1) Verificamos si la víctima ERA admin antes
    const oldAdmins = adminCache[chatId] || new Set();
    if (oldAdmins.has(target)) {
      // 4.2) Aplicar castigo de 24h
      const now = Date.now();
      blacklist[actor] = now + 24 * 60 * 60 * 1000;
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2));

      await conn.groupParticipantsUpdate(chatId, [actor], 'demote').catch(() => {});

      await conn.sendMessage(chatId, {
        text: `
🚨 *ADMINISTRADOR EXPULSADO*

❌ El admin @${actor.split('@')[0]} eliminó a @${target.split('@')[0]} del grupo.

⛔ Sólo se castiga cuando la víctima era OTRO ADMIN.

🕒 Su rol ha sido revocado por *24 horas*.

🔰 Exime con: *\/addlista @usuario*.
        `.trim(),
        mentions: [actor, target]
      });
    }
  }
}
// —> aquí NUNCA usamos return; así el código sigue y llega a tus despedidas

// 5) BLOQUEO AL READMINISTRAR CASTIGADOS
for (const id of update.participants || []) {
  const pInfo     = metadata.participants.find(p => p.id === id);
  const isNowAdmin = pInfo?.admin === 'admin' || pInfo?.admin === 'superadmin';
  const until      = blacklist[id];

  if (isNowAdmin && until && Date.now() < until) {
    if (whiteList.includes(id)) continue; // exento

    // 5.1) Volver a degradar
    await conn.groupParticipantsUpdate(chatId, [id], 'demote').catch(() => {});

    // 5.2) Notificar con explicación de /addlista
    await conn.sendMessage(chatId, {
      text: `
🚫 @${id.split('@')[0]} está castigado por conducta indebida.

⏳ No podrá ser admin hasta que pasen 24 horas.

🔰 Para eximir a un admin de este castigo, usa *\/addlista @${id.split('@')[0]}*.
      `.trim(),
      mentions: [id]
    });
  }
}

// 🔒 FIN SISTEMA DE PROTECCIÓN 🔒

      
// 🔰 Aviso simple cuando ascienden a admin
if (update.action === "promote" && update.participants?.length) {
  const actor = update.author;
  const target = update.participants[0];
  if (actor && target) {
    const texto = `
╭──『 👑 *NUEVO ADMIN* 』─◆
│ 👤 Usuario: @${target.split("@")[0]}
│ ✅ Ascendido por: @${actor.split("@")[0]}
╰────────────────────◆`.trim();

    await conn.sendMessage(chatId, {
      text: texto,
      mentions: [actor, target]
    });
  }
}


      
// 🔒 FIN SISTEMA DE PROTECCIÓN Y AVISO DE CAMBIOS DE ADMIN 🔒
      for (const participant of update.participants) {
        const phone = participant.split("@")[0];
        const mention = `@${phone}`;

        if (update.action === "add") {
          if (antiArabe == 1 && arabes.some(p => phone.startsWith(p))) {
            const info = metadata.participants.find(p => p.id === participant);
            const isAdmin = info?.admin === "admin" || info?.admin === "superadmin";
            const isOwner = global.isOwner && global.isOwner(participant);
            if (!isAdmin && !isOwner) {
              await conn.sendMessage(chatId, {
                text: `🚫 ${mention} tiene un número prohibido y será eliminado.`,
                mentions: [participant]
              });
              try {
                await conn.groupParticipantsUpdate(chatId, [participant], "remove");
              } catch {}
              continue;
            }
          }

          if (welcomeActive != 1) continue;

          let perfilURL;
          try {
            perfilURL = await conn.profilePictureUrl(participant, "image");
          } catch {
            try {
              perfilURL = await conn.profilePictureUrl(chatId, "image");
            } catch {
              perfilURL = "https://cdn.russellxz.click/e72cc417.jpeg";
            }
          }

          if (bienvenidaPersonalizada) {
            await conn.sendMessage(chatId, {
              image: { url: perfilURL },
              caption: `👋 ${mention}

${bienvenidaPersonalizada}`,
              mentions: [participant]
            });
          } else {
            const mensaje = mensajesBienvenida[Math.floor(Math.random() * mensajesBienvenida.length)];
            const modo = Math.random() < 0.5 ? "video" : "imagen";

            if (modo === "video") {
              await conn.sendMessage(chatId, {
                video: { url: "https://cdn.russellxz.click/8e968c1d.mp4" },
                caption: `👋 ${mention}

${mensaje}`,
                mentions: [participant]
              });
            } else {
              const avatar = await loadImage(perfilURL);
              const fondo = await loadImage("https://cdn.russellxz.click/e72cc417.jpeg");
              const canvas = createCanvas(1080, 720);
              const ctx = canvas.getContext("2d");
              ctx.drawImage(fondo, 0, 0, canvas.width, canvas.height);
              ctx.save();
              ctx.beginPath();
              ctx.arc(150, 150, 85, 0, Math.PI * 2);
              ctx.closePath();
              ctx.clip();
              ctx.globalAlpha = 0.85;
              ctx.drawImage(avatar, 65, 65, 170, 170);
              ctx.restore();
              ctx.globalAlpha = 1.0;

              await conn.sendMessage(chatId, {
                image: canvas.toBuffer(),
                caption: `👋 ${mention}

${mensaje}`,
                mentions: [participant]
              });
            }
          }

        } else if (update.action === "remove" && byeActive == 1) {
          let perfilURL;
          try {
            perfilURL = await conn.profilePictureUrl(participant, "image");
          } catch {
            try {
              perfilURL = await conn.profilePictureUrl(chatId, "image");
            } catch {
              perfilURL = "https://cdn.russellxz.click/e72cc417.jpeg";
            }
          }

          if (despedidaPersonalizada) {
            await conn.sendMessage(chatId, {
              image: { url: perfilURL },
              caption: `👋 ${mention}

${despedidaPersonalizada}`,
              mentions: [participant]
            });
          } else {
            const mensaje = mensajesDespedida[Math.floor(Math.random() * mensajesDespedida.length)];
            const modo = Math.random() < 0.5 ? "video" : "imagen";

            if (modo === "video") {
              await conn.sendMessage(chatId, {
                video: { url: "https://cdn.russellxz.click/6a4bd220.mp4" },
                caption: `👋 ${mention}

${mensaje}`,
                mentions: [participant]
              });
            } else {
              const avatar = await loadImage(perfilURL);
              const fondo = await loadImage("https://cdn.russellxz.click/86913470.jpeg");
              const canvas = createCanvas(1080, 720);
              const ctx = canvas.getContext("2d");
              ctx.drawImage(fondo, 0, 0, canvas.width, canvas.height);
              ctx.save();
              ctx.beginPath();
              ctx.arc(150, 150, 85, 0, Math.PI * 2);
              ctx.closePath();
              ctx.clip();
              ctx.globalAlpha = 0.85;
              ctx.drawImage(avatar, 65, 65, 170, 170);
              ctx.restore();
              ctx.globalAlpha = 1.0;

              await conn.sendMessage(chatId, {
                image: canvas.toBuffer(),
                caption: `👋 ${mention}

${mensaje}`,
                mentions: [participant]
              });
            }
          }
        }
      }
//ok
const newMeta = await conn.groupMetadata(chatId);
adminCache[chatId] = new Set(
  newMeta.participants
    .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
    .map(p => p.id)
);
      //ok
      
      
    } catch (err) {
      console.error("❌ Error en lógica de grupo:", err);
    }
  });
};

handler.run = handler;
module.exports = handler;
