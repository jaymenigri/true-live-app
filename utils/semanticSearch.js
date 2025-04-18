const { OpenAI } = require('openai');
const firebase = require('../services/firebaseService');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function cosineSimilarity(vecA, vecB) {
  try {
    const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  } catch (error) {
    console.error('❌ Erro ao calcular similaridade:', error.message);
    return 0; // Retorna 0 em caso de erro
  }
}

async function searchDocuments(query, limit = 3) {
  try {
    console.log(`🔎 Buscando documentos para: "${query}"`);
    
    // Gerar embedding para a pergunta
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query
    });
    const queryEmbedding = response.data[0].embedding;
    
    // Buscar todos os documentos da base
    console.log('📚 Recuperando documentos do Firebase...');
    const documents = await firebase.getDocuments();
    console.log(`📊 Recuperados ${documents.length} documentos`);
    
    if (documents.length === 0) {
      console.warn('⚠️ Nenhum documento disponível para busca');
      return [];
    }
    
    // Calcular similaridade com cada documento
    console.log('🧮 Calculando similaridades...');
    const scoredDocs = [];
    
    for (const doc of documents) {
      if (!doc.embedding || !Array.isArray(doc.embedding)) {
        console.warn(`⚠️ Documento ${doc.id} sem embedding válido`);
        continue;
      }
      
      const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
      scoredDocs.push({
        ...doc,
        similarity
      });
    }
    
    // Ordenar por similaridade e pegar os top N
    const topResults = scoredDocs
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    console.log(`✅ Encontrados ${topResults.length} documentos relevantes`);
    
    // Log detalhado dos documentos encontrados
    topResults.forEach((doc, index) => {
      console.log(`📄 #${index+1}: "${doc.title.substring(0, 30)}..." (${doc.similarity.toFixed(3)})`);
    });
    
    return topResults;
  } catch (error) {
    console.error('❌ Erro na busca semântica:', error.message);
    return [];
  }
}

module.exports = { searchDocuments };
