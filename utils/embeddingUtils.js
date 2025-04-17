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
  
  // Tenta vários caminhos possíveis para encontrar o arquivo
  const possiblePaths = [
    path.join(__dirname, '../data/fontes_categorizado.json'),
    path.join(process.cwd(), 'data/fontes_categorizado.json'),
    path.join(process.cwd(), './data/fontes_categorizado.json'),
    './data/fontes_categorizado.json',
    '../data/fontes_categorizado.json'
  ];
  
  let raw = null;
  let usedPath = null;
  
  // Tenta cada caminho até encontrar o arquivo
  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        raw = fs.readFileSync(filePath, 'utf8');
        usedPath = filePath;
        console.log(`✅ Arquivo encontrado em: ${filePath}`);
        break;
      }
    } catch (error) {
      console.error(`❌ Erro ao tentar caminho ${filePath}:`, error.message);
    }
  }
  
  if (!raw) {
    console.error('❌ Arquivo fontes_categorizado.json não encontrado em nenhum caminho tentado');
    return [];
  }
  
  try {
    cachedData = JSON.parse(raw);
    console.log(`📚 Carregadas ${cachedData.length} perguntas da base de conhecimento`);
    return cachedData;
  } catch (error) {
    console.error('❌ Erro ao fazer parse do JSON:', error.message);
    return [];
  }
}

async function findMostSimilarQuestion(pergunta) {
  try {
    console.log(`🔎 Buscando resposta para: "${pergunta}"`);
    const dados = await loadEmbeddings();
    
    if (!dados || dados.length === 0) {
      console.warn('⚠️ Base de conhecimento vazia ou não carregada');
      return null;
    }
    
    console.log(`📚 Comparando com ${dados.length} perguntas na base de conhecimento`);
    const embeddingPergunta = await getEmbedding(pergunta);

    let maisSimilar = null;
    let maiorSimilaridade = 0;

    for (const item of dados) {
      if (!item.embedding || !Array.isArray(item.embedding)) {
        console.warn(`⚠️ Item sem embedding válido: ${item.pergunta}`);
        continue;
      }
      
      const sim = cosineSimilarity(embeddingPergunta, item.embedding);
      if (sim > maiorSimilaridade) {
        maiorSimilaridade = sim;
        maisSimilar = { ...item, similarity: sim };
      }
    }
    
    // Limite mínimo de similaridade para considerar uma correspondência
    const limiteMinimo = 0.4; // Reduzido para ser mais tolerante
    
    if (maisSimilar && maisSimilar.similarity >= limiteMinimo) {
      console.log(`✅ Melhor correspondência: "${maisSimilar.pergunta}" (${maisSimilar.similarity.toFixed(3)})`);
      return maisSimilar;
    } else {
      const similaridade = maisSimilar ? maisSimilar.similarity.toFixed(3) : 'N/A';
      console.warn(`⚠️ Nenhuma correspondência acima do limite mínimo. Melhor similaridade: ${similaridade}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao buscar pergunta similar:', error);
    return null;
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
