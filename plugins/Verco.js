const handler = async (msg, { conn }) => {
  // Obtener prefijo actual
  const prefijo = global.prefixes?.[0] || ".";

  // Extraer todos los comandos
  const todosLosComandos = global.plugins.flatMap(plugin => {
    if (!plugin.command) return [];
    return Array.isArray(plugin.command) ? plugin.command : [plugin.command];
  });

  const total = todosLosComandos.length;

  const texto = `
╔═════════════════╗
║ 🤖 *suki Omega Project*  
╚═════════════════╝

🧠 *Este es un nuevo bot creado desde cero.*
🔧 *Total comandos activos:* ${total}
🔑 *Prefijo actual:* ${prefijo}

📦 *Lista de comandos:*
${todosLosComandos.map(c => `➤ ${prefijo}${c}`).join("\n")}

💫 *Gracias por usar suki Omega.*
`.trim();

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "🧩", key: msg.key }
  });

  return conn.sendMessage(msg.key.remoteJid, { text: texto }, { quoted: msg });
};

handler.command = ["verco"];
module.exports = handler;
