// utils/fonte_loader.js
const path = require("path");

function loadFontes() {
  try {
    const fonteModule = require(path.resolve("fontes.js"));

    // Verifica se exportou como { default: [...] } ou diretamente como [...]
    const fontes = Array.isArray(fonteModule)
      ? fonteModule
      : Array.isArray(fonteModule.default)
      ? fonteModule.default
      : null;

    if (!Array.isArray(fontes)) {
      throw new Error("❌ Arquivo fontes.js não contém um array exportado.");
    }

    console.log(`✅ ${fontes.length} fontes carregadas do fontes.js`);
    return fontes;
  } catch (error) {
    console.error("❌ Erro ao carregar fontes.js:", error.message);
    return [];
  }
}

module.exports = { loadFontes };
