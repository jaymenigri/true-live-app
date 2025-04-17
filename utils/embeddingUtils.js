const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Base de conhecimento incorporada diretamente no código
const KNOWLEDGE_BASE = [
  {
    "pergunta": "Quem foi Golda Meir?",
    "resposta": "Golda Meir foi a quarta Primeira-Ministra de Israel, servindo de 1969 a 1974. Nascida em Kiev, emigrou para os Estados Unidos ainda jovem e depois para a Palestina. Foi uma das signatárias da Declaração de Independência de Israel e teve papel fundamental no governo durante a Guerra do Yom Kippur.",
    "embedding": [0.12, 0.45, 0.78, 0.23, 0.67, 0.89, 0.91, 0.56, 0.12, 0.34],
    "fonte": "Ministério das Relações Exteriores de Israel"
  },
  {
    "pergunta": "Quem foi o primeiro presidente de Israel?",
    "resposta": "O primeiro presidente de Israel foi Chaim Weizmann. Ele assumiu o cargo em 1949 e foi uma figura chave no movimento sionista e na fundação do Estado de Israel.",
    "embedding": [0.11, 0.41, 0.75, 0.21, 0.61, 0.85, 0.92, 0.53, 0.10, 0.30],
    "fonte": "Ministério das Relações Exteriores de Israel"
  },
  {
    "pergunta": "O que foi a Guerra do Yom Kippur?",
    "resposta": "A Guerra do Yom Kippur ocorreu em 1973, quando Egito e Síria atacaram Israel de surpresa no dia mais sagrado do judaísmo. Israel conseguiu se recuperar e repelir os ataques, mas o conflito teve impacto profundo no país.",
    "embedding": [0.14, 0.43, 0.73, 0.26, 0.66, 0.82, 0.94, 0.50, 0.13, 0.36],
    "fonte": "Instituto de Estudos de Segurança Nacional de Israel"
  },
  {
    "pergunta": "O que é o MFA.gov.il?",
    "resposta": "É o site oficial do Ministério das Relações Exteriores de Israel, com informações sobre segurança, diplomacia e atualizações políticas do governo israelense.",
    "fonte": "MFA.gov.il",
    "embedding": [0.776356, 0.200217, 0.972839, 0.896347, 0.483411]
  },
  {
    "pergunta": "O que é o JPost.com?",
    "resposta": "O Jerusalem Post é um dos principais jornais israelenses em inglês, com cobertura ampla sobre política, conflitos e sociedade de Israel e do mundo judaico.",
    "fonte": "JPost.com",
    "embedding": [0.133004, 0.523076, -0.517633, 0.022841, 0.854739]
  },
  {
    "pergunta": "Quem é Rafael Rozenszajn?",
    "resposta": "Rafael Rozenszajn é porta-voz das Forças de Defesa de Israel (IDF), frequentemente citado em entrevistas e comunicados sobre a segurança de Israel.",
    "fonte": "IDF via entrevistas públicas",
    "embedding": [0.294378, 0.96946, -0.325894, 0.966648, 0.825118]
  },
  {
    "pergunta": "Quem é Alan Dershowitz?",
    "resposta": "Alan Dershowitz é um advogado e professor de Harvard conhecido por sua defesa dos direitos civis e apoio a Israel, autor de vários livros sobre o tema.",
    "fonte": "Alan Dershowitz",
    "embedding": [-0.207056, 0.085812, 0.302337, 0.049858, -0.19846]
  },
  {
    "pergunta": "Quem é Samuel Feldberg?",
    "resposta": "Professor e analista político especializado em Oriente Médio e segurança israelense, com publicações acadêmicas e entrevistas na mídia.",
    "fonte": "Samuel Feldberg",
    "embedding": [-0.875923, 0.112596, 0.499466, -0.711706, -0.218763]
  },
  {
    "pergunta": "Quando foi fundado o Estado de Israel?",
    "resposta": "O Estado de Israel foi oficialmente fundado em 14 de maio de 1948, quando David Ben-Gurion, que se tornou o primeiro primeiro-ministro do país, declarou formalmente a independência. Esta declaração ocorreu no último dia do Mandato Britânico sobre a Palestina.",
    "fonte": "Ministério das Relações Exteriores de Israel",
    "embedding": [0.176356, 0.300217, 0.872839, 0.796347, 0.583411]
  },
  {
    "pergunta": "Quem foi David Ben-Gurion?",
    "resposta": "David Ben-Gurion foi o principal fundador e primeiro primeiro-ministro do Estado de Israel. Ele liderou o país durante a Guerra da Independência de 1948 e é considerado o 'pai da nação'. Ben-Gurion foi um pioneiro sionista, líder trabalhista e desempenhou papel fundamental na construção das instituições do Estado judeu antes e depois da independência.",
    "fonte": "Arquivos Ben-Gurion",
    "embedding": [0.233004, 0.623076, -0.417633, 0.122841, 0.954739]
  },
  {
    "pergunta": "O que é o Muro das Lamentações?",
    "resposta": "O Muro das Lamentações (Kotel em hebraico) é o último remanescente do antigo Templo de Jerusalém, especificamente o muro de contenção ocidental que cercava o Monte do Templo. É o local mais sagrado onde os judeus têm permissão para rezar e representa aproximadamente 2.000 anos de história judaica e conexão com Jerusalém. É um símbolo central da fé judaica e da continuidade histórica do povo judeu em sua terra ancestral.",
    "fonte": "Autoridade de Antiguidades de Israel",
    "embedding": [0.394378, 0.86946, -0.225894, 0.866648, 0.725118]
  },
  {
    "pergunta": "O que foi a Guerra dos Seis Dias?",
    "resposta": "A Guerra dos Seis Dias foi um conflito armado ocorrido entre 5 e 10 de junho de 1967, quando Israel lutou contra Egito, Síria e Jordânia. A guerra começou com um ataque preventivo israelense contra a força aérea egípcia, após crescentes tensões e ameaças dos estados árabes vizinhos. Israel conquistou a Península do Sinai, Faixa de Gaza, Cisjordânia, Jerusalém Oriental e Colinas de Golã, triplicando seu território. A guerra mudou drasticamente a geopolítica do Oriente Médio e seus efeitos são sentidos até hoje.",
    "fonte": "Instituto de Estudos de Segurança Nacional de Israel",
    "embedding": [-0.307056, 0.185812, 0.402337, 0.149858, -0.09846]
  },
  {
    "pergunta": "O que é o Kibbutz?",
    "resposta": "Kibbutz é uma forma única de comunidade coletiva israelense que combina socialismo e sionismo. Tradicionalmente, os kibbutzim (plural de kibbutz) eram comunidades agrícolas onde todos os bens eram de propriedade comum e as decisões eram tomadas democraticamente. Os membros trabalhavam na fazenda ou em indústrias do kibbutz, não recebiam salário, mas tinham todas as necessidades atendidas pela comunidade. Embora muitos kibbutzim tenham se privatizado parcialmente nas últimas décadas, eles desempenharam papel fundamental no estabelecimento do Estado de Israel e na formação da identidade e cultura israelenses.",
    "fonte": "Movimento Kibbutz",
    "embedding": [-0.775923, 0.212596, 0.599466, -0.611706, -0.118763]
  },
  {
    "pergunta": "Quem foi Theodor Herzl?",
    "resposta": "Theodor Herzl (1860-1904) foi o fundador do sionismo político moderno. Jornalista judeu austro-húngaro, ele concluiu que os judeus precisavam de seu próprio estado para escapar do antissemitismo europeu, após cobrir o caso Dreyfus na França. Em 1896, publicou 'O Estado Judeu' (Der Judenstaat), apresentando sua visão para uma nação judaica. Em 1897, organizou o Primeiro Congresso Sionista em Basel, Suíça, estabelecendo a Organização Sionista. Herzl é reverenciado como o visionário do Estado de Israel, que surgiu 44 anos após sua morte.",
    "fonte": "Organização Sionista Mundial",
    "embedding": [0.313004, 0.723076, -0.317633, 0.222841, 0.854739]
  },
  {
    "pergunta": "O que é o Mossad?",
    "resposta": "O Mossad (Instituto para Inteligência e Operações Especiais) é a agência de inteligência estrangeira de Israel, responsável por operações de coleta de inteligência, ação encoberta e contraterrorismo fora do território israelense. Fundado em 1949, é uma das agências de inteligência mais respeitadas e temidas do mundo. O Mossad é conhecido por operações de alto perfil, incluindo a captura de Adolf Eichmann na Argentina, operações contra terroristas que atacaram atletas israelenses nas Olimpíadas de Munique e operações contra programas nucleares hostis.",
    "fonte": "Governo de Israel",
    "embedding": [0.494378, 0.76946, -0.125894, 0.766648, 0.625118]
  },
  {
    "pergunta": "O que é o Hamas?",
    "resposta": "O Hamas (Movimento de Resistência Islâmica) é uma organização palestina fundamentalista islâmica e grupo terrorista que controla a Faixa de Gaza desde 2007. Fundado em 1987 durante a Primeira Intifada, tem como objetivo declarado em sua carta fundacional a destruição de Israel e o estabelecimento de um estado islâmico na Palestina histórica. O Hamas está dividido em uma ala política e uma ala militar (Brigadas Izz ad-Din al-Qassam). É designado como organização terrorista por muitos países, incluindo Estados Unidos, União Europeia, Reino Unido e outros. O grupo é responsável por numerosos ataques contra civis israelenses, incluindo atentados suicidas, lançamentos de foguetes e túneis de infiltração.",
    "fonte": "Instituto de Contraterrorismo de Israel",
    "embedding": [-0.107056, 0.285812, 0.502337, 0.249858, -0.29846]
  },
  {
    "pergunta": "O que é o Hezbollah?",
    "resposta": "O Hezbollah ('Partido de Deus') é uma organização xiita libanesa que funciona como partido político, milícia armada e organização terrorista. Fundado em 1982 durante a Guerra Civil Libanesa com apoio do Irã, tem como objetivos declarados a resistência contra Israel e a implementação de um estado islâmico no Líbano. O Hezbollah é fortemente armado, possuindo um arsenal estimado de mais de 150.000 foguetes e mísseis, e é considerado um proxy do Irã. É designado como organização terrorista por muitos países ocidentais e foi responsável por numerosos ataques contra alvos israelenses, judeus e ocidentais ao longo das décadas.",
    "fonte": "Ministério da Defesa de Israel",
    "embedding": [-0.675923, 0.312596, 0.699466, -0.511706, -0.018763]
  },
  {
    "pergunta": "O que são os Acordos de Abraão?",
    "resposta": "Os Acordos de Abraão são uma série de tratados de normalização diplomática entre Israel e países árabes/muçulmanos, iniciados em 2020. Os primeiros acordos foram assinados com Emirados Árabes Unidos e Bahrein em setembro de 2020, seguidos por Sudão e Marrocos. Esses acordos representam uma mudança significativa na política regional, pois tradicionalmente a maioria dos estados árabes condicionava a normalização com Israel à resolução da questão palestina. Os acordos facilitaram cooperação econômica, segurança, tecnologia, turismo e intercâmbios culturais, criando uma nova dinâmica regional no Oriente Médio contra a influência do Irã.",
    "fonte": "Ministério das Relações Exteriores de Israel",
    "embedding": [0.413004, 0.823076, -0.217633, 0.322841, 0.754739]
  }
];

// Função para calcular similaridade de cosseno
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Função para gerar embedding
async function getEmbedding(text) {
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

// Função para dividir resposta em partes menores
function dividirResposta(texto, limite = 1000) {
  const partes = [];
  let inicio = 0;
  while (inicio < texto.length) {
    partes.push(texto.substring(inicio, inicio + limite));
    inicio += limite;
  }
  return partes;
}

// Função para encontrar a pergunta mais similar
async function findMostSimilarQuestion(pergunta) {
  try {
    console.log(`🔎 Buscando resposta para: "${pergunta}"`);
    
    // Verificar se temos uma base de conhecimento
    if (!KNOWLEDGE_BASE || KNOWLEDGE_BASE.length === 0) {
      console.warn('⚠️ Base de conhecimento vazia');
      return null;
    }
    
    console.log(`📚 Comparando com ${KNOWLEDGE_BASE.length} perguntas na base de conhecimento`);
    
    // Gerar embedding para a pergunta do usuário
    const embeddingPergunta = await getEmbedding(pergunta);

    // Encontrar a pergunta mais similar
    let maisSimilar = null;
    let maiorSimilaridade = 0;

    for (const item of KNOWLEDGE_BASE) {
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
    const limiteMinimo = 0.3; // Bem tolerante para testes
    
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

module.exports = {
  getEmbedding,
  findMostSimilarQuestion,
  dividirResposta,
  KNOWLEDGE_BASE
};
