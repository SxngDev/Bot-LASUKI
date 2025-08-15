const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const db = new Database(path.resolve("activos.db"));

// Crear tabla si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS config (
    chat_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (chat_id, key)
  )
`).run();

/**
 * 🔧 Guardar o actualizar una configuración
 * @param {string} chatId - ID del grupo o chat
 * @param {string} key - Clave como "modoadmins"
 * @param {string|number} value - Valor (1, 0, "on", "off"...)
 */
function setConfig(chatId, key, value) {
  db.prepare(`
    INSERT OR REPLACE INTO config (chat_id, key, value)
    VALUES (?, ?, ?)
  `).run(chatId, key, value.toString());
}

/**
 * 🔎 Obtener el valor de una configuración
 * @param {string} chatId - ID del grupo o chat
 * @param {string} key - Clave de configuración
 * @returns {string|null} - Valor guardado o null
 */
function getConfig(chatId, key) {
  const row = db.prepare(`
    SELECT value FROM config
    WHERE chat_id = ? AND key = ?
  `).get(chatId, key);
  return row?.value || null;
}

/**
 * ❌ Eliminar una configuración
 * @param {string} chatId - ID del grupo o chat
 * @param {string} key - Clave a eliminar
 */
function deleteConfig(chatId, key) {
  db.prepare(`
    DELETE FROM config
    WHERE chat_id = ? AND key = ?
  `).run(chatId, key);
}

/**
 * 📋 Obtener todas las claves activadas en un chat
 * @param {string} chatId
 * @returns {Object} - Todas las configuraciones del chat
 */
function getAllConfigs(chatId) {
  const rows = db.prepare(`
    SELECT key, value FROM config
    WHERE chat_id = ?
  `).all(chatId);

  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

// ===========================
// 💾 LÓGICA DE antidelete.db
// ===========================

const antideletePath = path.resolve("./antidelete.db");

/**
 * 📥 Obtener el contenido completo de antidelete.db
 * @returns {{g: Object, p: Object}}
 */
function getAntideleteDB() {
  try {
    if (!fs.existsSync(antideletePath)) {
      const init = { g: {}, p: {} };
      fs.writeFileSync(antideletePath, JSON.stringify(init, null, 2));
      return init;
    }

    const raw = fs.readFileSync(antideletePath, "utf-8").trim();

    if (!raw) {
      const init = { g: {}, p: {} };
      fs.writeFileSync(antideletePath, JSON.stringify(init, null, 2));
      return init;
    }

    return JSON.parse(raw);
  } catch (e) {
    console.error("❌ Error cargando antidelete.db, se regenerará:", e);
    const init = { g: {}, p: {} };
    fs.writeFileSync(antideletePath, JSON.stringify(init, null, 2));
    return init;
  }
}

/**
 * 💾 Guardar el contenido completo de antidelete.db
 * @param {{g: Object, p: Object}} data
 */
function saveAntideleteDB(data) {
  fs.writeFileSync(antideletePath, JSON.stringify(data, null, 2));
}

module.exports = {
  setConfig,
  getConfig,
  deleteConfig,
  getAllConfigs,
  getAntideleteDB,
  saveAntideleteDB
};
