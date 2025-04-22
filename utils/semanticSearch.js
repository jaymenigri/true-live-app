// utils/semanticSearch.js
const { OpenAI } = require('openai');
const firebase = require('../services/firebaseService');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SIMILARITY_THRESHOLD = 0.3;

function cosineSimilarity(vecA, vecB) {
  try {
    const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  } catch (error) {
    console.error('❌ Erro ao calcular similaridade:', error.message);
    return 0;
  }
}

async function buscar(query, limit = 3) {
  try {
    console.log(`🔎 Buscando documentos para: "${query}"`);

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query
    });
    const queryEmbedding = response.data[0].embedding;

    console.log('📚 Recuperando documentos do Firebase...');
    const documents = await firebase.getDocuments();
    console.log(`📊 Recuperados ${documents.length} documentos`);

    if (documents.length === 0) {
      console.warn('⚠️ Nenhum documento disponível para busca');
      return [];
    }

    console.log('🧮 Calculando similaridades...');
    const scoredDocs = [];

    for (const doc of documents) {
      if (!doc.embedding || !Array.isArray(doc.embedding)) {
        console.warn(`⚠️ Documento ${doc.id} sem embedding válido`);
        continue;
      }

      const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
      scoredDocs.push({ ...doc, similarity });
    }

    const topResults = scoredDocs
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    if (topResults.length > 0 && topResults[0].similarity >= SIMILARITY_THRESHOLD) {
      console.log(`✅ Encontrados ${topResults.length} documentos relevantes`);
      topResults.forEach((doc, index) => {
        console.log(`📄 #${index + 1}: "${doc.title ? doc.title.substring(0, 30) : 'Sem título'}..." (${doc.similarity.toFixed(3)})`);
      });

      return topResults;
    } else {
      console.warn(`⚠️ Similaridade abaixo do limiar (${SIMILARITY_THRESHOLD}). Usando fallback.`);
      return [];
    }
  } catch (error) {
    console.error('❌ Erro na busca semântica:', error.message);
    return [];
  }
}

module.exports = { buscar };
