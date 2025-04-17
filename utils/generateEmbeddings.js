// utils/generateEmbeddings.js
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Função para gerar embeddings para uma pergunta
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Erro ao gerar embedding:', error.message);
    throw error;
  }
}

// Função para carregar o arquivo JSON existente
function loadExistingData() {
  const filePath = path.join(__dirname, '../data/fontes_categorizado.json');
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
    return [];
  } catch (error) {
    console.error('❌ Erro ao carregar arquivo existente:', error.message);
    return [];
  }
}

// Função para salvar os dados de volta ao arquivo
function saveData(data) {
  const filePath = path.join(__dirname, '../data/fontes_categorizado.json');
  const dirPath = path.dirname(filePath);
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log('✅ Dados salvos com sucesso em', filePath);
}

// Função principal para adicionar novas entradas com embeddings
async function addNewEntriesWithEmbeddings(newEntries) {
  // Carregar dados existentes
  const existingData = loadExistingData();
  
  // Processar novas entradas e gerar embeddings
  const processedEntries = [];
  
  for (const entry of newEntries) {
    try {
      console.log(`🔄 Gerando embedding para: "${entry.pergunta.substring(0, 40)}..."`);
      const embedding = await generateEmbedding(entry.pergunta);
      
      processedEntries.push({
        pergunta: entry.pergunta,
        resposta: entry.resposta,
        fonte: entry.fonte || 'Fonte não especificada',
        embedding: embedding,
        texto: entry.resposta // Mantém uma cópia da resposta no campo texto para compatibilidade
      });
      
      console.log('✅ Embedding gerado com sucesso!');
    } catch (error) {
      console.error(`❌ Falha ao processar entrada "${entry.pergunta}":`, error.message);
    }
  }
  
  // Combinar dados existentes com novos dados
  const combinedData = [...existingData, ...processedEntries];
  
  // Salvar dados combinados
  saveData(combinedData);
  
  return {
    totalExistentes: existingData.length,
    totalAdicionadas: processedEntries.length,
    totalCombinadas: combinedData.length
  };
}

module.exports = {
  addNewEntriesWithEmbeddings,
  generateEmbedding
};

// Executar diretamente se chamado como script
if (require.main === module) {
  // Este bloco só será executado se o arquivo for chamado diretamente com node
  console.log('📚 Ferramenta de geração de embeddings para fontes do True Live');
  console.log('ℹ️ Este script deve ser importado e utilizado por outro programa.');
}
