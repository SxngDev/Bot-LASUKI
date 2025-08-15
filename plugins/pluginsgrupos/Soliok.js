const handler = async (conn) => {
  conn.ev.on("_event-accept", async (update) => {
    try {
      console.log("📡 [EVENTO DE PRUEBA] _event-accept detectado:", update);

      const chatId = update.id || update.chatId;
      const isGroup = chatId && chatId.endsWith("@g.us");
      if (!isGroup) return;

      const groupInfo = await conn.groupMetadata(chatId);
      if (groupInfo?.approvalMode !== "admin_only") {
        await conn.groupSettingUpdate(chatId, { approval_mode: "admin_only" });
        console.log("🔒 Modo admin_only activado en:", chatId);
      }

      const arabes = [
        "20", "212", "213", "216", "218", "222", "224", "230", "234", "235", "237", "238", "249",
        "250", "251", "252", "253", "254", "255", "257", "258", "260", "263", "269", "960", "961",
        "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973", "974", "975",
        "976", "980", "981", "992", "994", "995", "998"
      ];

      const participantes = update.participants || [];

      for (const user of participantes) {
        const phone = user.split("@")[0];
        const isArabe = arabes.some(pref => phone.startsWith(pref));

        if (isArabe) {
          await conn.groupRequestReject(chatId, [user]);
          console.log(`❌ Rechazada solicitud de @${phone} (árabe)`);

          await conn.sendMessage(chatId, {
            text: `🚫 Solicitud rechazada de @${phone} por ser número árabe.`,
            mentions: [user]
          });
        } else {
          await conn.groupRequestApprove(chatId, [user]);
          console.log(`✅ Aprobada solicitud de @${phone}`);

          await conn.sendMessage(chatId, {
            text: `✅ Solicitud aceptada de @${phone}`,
            mentions: [user]
          });
        }
      }
    } catch (e) {
      console.error("❌ Error en _event-accept handler:", e);
    }
  });
};

handler.run = handler;
module.exports = handler;
