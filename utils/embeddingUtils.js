const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let cachedData = null;

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text
  });
  return response.data[0].embedding;
}

function dividirResposta(texto, limite = 1000) {
  const partes = [];
  let inicio = 0;
  while (inicio < texto.length) {
    partes.push(texto.substring(inicio, inicio + limite));
    inicio += limite;
  }
  return partes;
}

async function loadEmbeddings() {
  if (cachedData) return cachedData;
const filePath = path.join(process.cwd(), 'data/fontes_categorizado.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  cachedData = JSON.parse(raw);
  return cachedData;
}

async function findMostSimilarQuestion(pergunta) {
  const dados = await loadEmbeddings();
  const embeddingPergunta = await getEmbedding(pergunta);

  let maisSimilar = null;
  let maiorSimilaridade = 0;

  for (const item of dados) {
    const sim = cosineSimilarity(embeddingPergunta, item.embedding);
    if (sim > maiorSimilaridade) {
      maiorSimilaridade = sim;
      maisSimilar = { ...item, similarity: sim };
    }
  }

  return maisSimilar;
}

module.exports = {
  getEmbedding,
  findMostSimilarQuestion,
  dividirResposta,
  loadEmbeddings
};
