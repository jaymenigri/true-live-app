const { OpenAI } = require('openai');
const firebase = require('../services/firebaseService');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.slice(0, 8000) // Limite para a API
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Erro ao gerar embedding para documento:', error.message);
    throw error;
  }
}

async function indexDocument(document) {
  try {
    // Verificar se document tem os campos obrigatórios
    if (!document.title || !document.content || !document.source) {
      throw new Error('Documento precisa ter título, conteúdo e fonte');
    }

    // Gerar ID único se não fornecido
    const docId = document.id || `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Gerar embedding
    const embedding = await generateEmbedding(document.content);
    
    // Preparar documento para armazenamento
    const docToStore = {
      id: docId,
      title: document.title,
      content: document.content,
      source: document.source,
      url: document.url || null,
      date: document.date || new Date().toISOString(),
      type: document.type || 'generic',
      embedding: embedding,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Salvar no Firebase
    await firebase.saveDocument(docToStore);
    
    console.log(`✅ Documento indexado com sucesso: ${docId}`);
    return { id: docId, success: true };
  } catch (error) {
    console.error(`❌ Erro ao indexar documento:`, error.message);
    return { id: document.id, success: false, error: error.message };
  }
}

async function batchIndexDocuments(documents) {
  const results = [];
  
  for (const doc of documents) {
    const result = await indexDocument(doc);
    results.push(result);
  }
  
  return results;
}

module.exports = {
  generateEmbedding,
  indexDocument,
  batchIndexDocuments
};
