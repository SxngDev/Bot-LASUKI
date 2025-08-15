const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");
const { readdirSync, statSync, unlinkSync } = require("fs");
const { getAntideleteDB, saveAntideleteDB } = requireFromRoot("db");

function limpiarCarpetaTmp() {
  const rutas = [os.tmpdir(), path.join(__dirname, "../tmp")];
  const archivos = [];

  for (const carpeta of rutas) {
    if (fs.existsSync(carpeta)) {
      for (const archivo of readdirSync(carpeta)) {
        const rutaCompleta = path.join(carpeta, archivo);
        const stats = statSync(rutaCompleta);
        if (stats.isFile() && (Date.now() - stats.mtimeMs >= 1000 * 60 * 1)) {
          try {
            unlinkSync(rutaCompleta);
            archivos.push(rutaCompleta);
          } catch (e) {
            console.error(`❌ Error borrando ${rutaCompleta}:`, e);
          }
        }
      }
    }
  }

  return archivos.length;
}

function limpiarAntideleteDB() {
  try {
    const db = getAntideleteDB();
    const limpiado = { g: {}, p: {} };
    saveAntideleteDB(limpiado);
    return true;
  } catch (e) {
    console.error("❌ Error limpiando antidelete.db:", e);
    return false;
  }
}

function run() {
  setInterval(() => {
    const count = limpiarCarpetaTmp();
    console.log(chalk.cyanBright(`🧼 Se eliminaron ${count} archivos de TMP.`));

    if (limpiarAntideleteDB()) {
      console.log(chalk.greenBright("✅ Se limpió antidelete.db correctamente."));
    }
  }, 30 * 60 * 1000); // Cada 30 minutos

  // Ejecutar una vez al iniciar
  const count = limpiarCarpetaTmp();
  console.log(chalk.cyanBright(`🧼 Limpieza inicial: ${count} archivos eliminados de TMP.`));

  if (limpiarAntideleteDB()) {
    console.log(chalk.greenBright("✅ Limpieza inicial de antidelete.db completada."));
  }
}

module.exports = {
  run
};
