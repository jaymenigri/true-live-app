const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return response.data[0].embedding;
}

function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function similarity(pergunta, embeddings) {
  const perguntaEmbedding = await getEmbedding(pergunta);
  const resultados = embeddings.map((fonte, index) => {
    const sim = cosineSimilarity(perguntaEmbedding, fonte.embedding);
    return { index, similarity: sim };
  });
  return resultados.sort((a, b) => b.similarity - a.similarity);
}

module.exports = similarity;
