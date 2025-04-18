const fs = require('fs');
const path = require('path');
const { batchIndexDocuments } = require('../utils/documentIndexer');
require('dotenv').config();

// Função para processar fontes do fontes.py
async function processFontes() {
  try {
    // Carregar fontes.py
    const fontesPath = path.join(__dirname, '../fontes.py');
    console.log(`📂 Buscando arquivo em: ${fontesPath}`);
    
    if (!fs.existsSync(fontesPath)) {
      console.error('❌ Arquivo fontes.py não encontrado');
      return;
    }
    
    const fontesContent = fs.readFileSync(fontesPath, 'utf8');
    
    // Extrair lista de fontes (parseamento simplificado)
    const fontesMatch = fontesContent.match(/fontes_especificas\s*=\s*\[([\s\S]*?)\]/);
    if (!fontesMatch) {
      throw new Error('Formato de fontes.py não reconhecido');
    }
    
    const fontesString = fontesMatch[1];
    const fontesItems = fontesString.split(',\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('"') || line.startsWith("'"));
    
    // Preparar documentos para indexação
    const documents = fontesItems.map((fonte, index) => {
      // Remover aspas e limpar
      fonte = fonte.replace(/^["']|["']$/g, '');
      
      // Classificar tipo de fonte (simples)
      let type = 'outros';
      if (fonte.includes('http')) type = 'website';
      else if (/\d{4}/.test(fonte)) type = 'livro';
      
      // Extrair título e fonte
      let title = fonte;
      let source = fonte;
      
      // Para entradas com hífen, separar título e fonte
      if (fonte.includes(' – ')) {
        const parts = fonte.split(' – ');
        title = parts[0].trim();
        source = parts[1] ? parts[1].trim() : parts[0].trim();
      }
      
      return {
        id: `fonte-${index}`,
        title: title,
        content: `Fonte confiável sobre Israel, judaísmo e Oriente Médio: ${fonte}. 
                 Esta fonte fornece informações precisas e perspectivas alinhadas 
                 com valores judaicos e israelenses.`,
        source: source,
        type: type
      };
    });
    
    console.log(`📚 Encontradas ${documents.length} fontes para indexação`);
    
    // Indexar documentos
    const results = await batchIndexDocuments(documents);
    
    // Exibir resultados
    const sucessos = results.filter(r => r.success).length;
    const falhas = results.filter(r => !r.success).length;
    
    console.log(`✅ Indexação concluída. ${sucessos} sucessos, ${falhas} falhas.`);
    
    if (falhas > 0) {
      console.log('⚠️ Falhas nas seguintes entradas:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`- ${r.id}: ${r.error}`);
      });
    }
  } catch (error) {
    console.error('❌ Erro ao processar fontes:', error);
  }
}

// Executar
processFontes();
