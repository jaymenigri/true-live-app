// fontes_categorizado.js
const fs = require('fs');
const path = require('path');

// Carregar dados do JSON
function loadFontesCategorizado() {
  try {
    const filePath = path.join(__dirname, './data/fontes_categorizado.json');
    
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(rawData);
    } else {
      console.warn('⚠️ Arquivo fontes_categorizado.json não encontrado. Retornando array vazio.');
      return [];
    }
  } catch (error) {
    console.error('❌ Erro ao carregar fontes_categorizado.json:', error);
    return [];
  }
}

const fontes = loadFontesCategorizado();

module.exports = fontes;
