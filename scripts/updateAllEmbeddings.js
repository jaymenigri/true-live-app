// scripts/updateAllEmbeddings.js
const fs = require('fs');
const path = require('path');
const { generateEmbedding } = require('../utils/generateEmbeddings');
require('dotenv').config();

const DATA_FILE = path.join(__dirname, '../data/fontes_categorizado.json');

async function updateAllEmbeddings() {
  console.log('🔄 Iniciando atualização de todos os embeddings...');
  
  try {
    // Carregar dados existentes
    if (!fs.existsSync(DATA_FILE)) {
      console.error('❌ Arquivo de dados não encontrado:', DATA_FILE);
      return;
    }
    
    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📚 Carregadas ${data.length} entradas para atualização`);
    
    // Atualizar embeddings para cada entrada
    const updatedData = [];
    let count = 0;
    
    for (const entry of data) {
      try {
        console.log(`\n[${++count}/${data.length}] Atualizando embedding para: "${entry.pergunta.substring(0, 40)}..."`);
        const newEmbedding = await generateEmbedding(entry.pergunta);
        
        updatedData.push({
          ...entry,
          embedding: newEmbedding
        });
        
        console.log('✅ Embedding atualizado com sucesso!');
      } catch (error) {
        console.error(`❌ Falha ao atualizar embedding para "${entry.pergunta}":`, error.message);
        // Manter o embedding original se houver falha
        updatedData.push(entry);
      }
    }
    
    // Salvar dados atualizados
    fs.writeFileSync(DATA_FILE, JSON.stringify(updatedData, null, 2), 'utf8');
    console.log(`\n✅ Todos os embeddings foram atualizados com sucesso!`);
    console.log(`📄 Arquivo salvo em: ${DATA_FILE}`);
    
  } catch (error) {
    console.error('❌ Erro durante a atualização de embeddings:', error);
  }
}

// Executar o script
updateAllEmbeddings();
