// scripts/addNewEntries.js
const { addNewEntriesWithEmbeddings } = require('../utils/generateEmbeddings');
require('dotenv').config();

// Lista de novas perguntas e respostas para adicionar
const novasEntradas = [
  {
    pergunta: "Quando foi fundado o Estado de Israel?",
    resposta: "O Estado de Israel foi oficialmente fundado em 14 de maio de 1948, quando David Ben-Gurion, que se tornou o primeiro primeiro-ministro do país, declarou formalmente a independência. Esta declaração ocorreu no último dia do Mandato Britânico sobre a Palestina.",
    fonte: "Ministério das Relações Exteriores de Israel"
  },
  {
    pergunta: "Quem foi David Ben-Gurion?",
    resposta: "David Ben-Gurion foi o principal fundador e primeiro primeiro-ministro do Estado de Israel. Ele liderou o país durante a Guerra da Independência de 1948 e é considerado o 'pai da nação'. Ben-Gurion foi um pioneiro sionista, líder trabalhista e desempenhou papel fundamental na construção das instituições do Estado judeu antes e depois da independência.",
    fonte: "Arquivos Ben-Gurion"
  },
  {
    pergunta: "O que é o Muro das Lamentações?",
    resposta: "O Muro das Lamentações (Kotel em hebraico) é o último remanescente do antigo Templo de Jerusalém, especificamente o muro de contenção ocidental que cercava o Monte do Templo. É o local mais sagrado onde os judeus têm permissão para rezar e representa aproximadamente 2.000 anos de história judaica e conexão com Jerusalém. É um símbolo central da fé judaica e da continuidade histórica do povo judeu em sua terra ancestral.",
    fonte: "Autoridade de Antiguidades de Israel"
  },
  {
    pergunta: "O que foi a Guerra dos Seis Dias?",
    resposta: "A Guerra dos Seis Dias foi um conflito armado ocorrido entre 5 e 10 de junho de 1967, quando Israel lutou contra Egito, Síria e Jordânia. A guerra começou com um ataque preventivo israelense contra a força aérea egípcia, após crescentes tensões e ameaças dos estados árabes vizinhos. Israel conquistou a Península do Sinai, Faixa de Gaza, Cisjordânia, Jerusalém Oriental e Colinas de Golã, triplicando seu território. A guerra mudou drasticamente a geopolítica do Oriente Médio e seus efeitos são sentidos até hoje.",
    fonte: "Instituto de Estudos de Segurança Nacional de Israel"
  },
  {
    pergunta: "O que é o Kibbutz?",
    resposta: "Kibbutz é uma forma única de comunidade coletiva israelense que combina socialismo e sionismo. Tradicionalmente, os kibbutzim (plural de kibbutz) eram comunidades agrícolas onde todos os bens eram de propriedade comum e as decisões eram tomadas democraticamente. Os membros trabalhavam na fazenda ou em indústrias do kibbutz, não recebiam salário, mas tinham todas as necessidades atendidas pela comunidade. Embora muitos kibbutzim tenham se privatizado parcialmente nas últimas décadas, eles desempenharam papel fundamental no estabelecimento do Estado de Israel e na formação da identidade e cultura israelenses.",
    fonte: "Movimento Kibbutz"
  },
  {
    pergunta: "Quem foi Theodor Herzl?",
    resposta: "Theodor Herzl (1860-1904) foi o fundador do sionismo político moderno. Jornalista judeu austro-húngaro, ele concluiu que os judeus precisavam de seu próprio estado para escapar do antissemitismo europeu, após cobrir o caso Dreyfus na França. Em 1896, publicou 'O Estado Judeu' (Der Judenstaat), apresentando sua visão para uma nação judaica. Em 1897, organizou o Primeiro Congresso Sionista em Basel, Suíça, estabelecendo a Organização Sionista. Herzl é reverenciado como o visionário do Estado de Israel, que surgiu 44 anos após sua morte.",
    fonte: "Organização Sionista Mundial"
  },
  {
    pergunta: "O que é o Mossad?",
    resposta: "O Mossad (Instituto para Inteligência e Operações Especiais) é a agência de inteligência estrangeira de Israel, responsável por operações de coleta de inteligência, ação encoberta e contraterrorismo fora do território israelense. Fundado em 1949, é uma das agências de inteligência mais respeitadas e temidas do mundo. O Mossad é conhecido por operações de alto perfil, incluindo a captura de Adolf Eichmann na Argentina, operações contra terroristas que atacaram atletas israelenses nas Olimpíadas de Munique e operações contra programas nucleares hostis.",
    fonte: "Governo de Israel"
  },
  {
    pergunta: "O que é o Hamas?",
    resposta: "O Hamas (Movimento de Resistência Islâmica) é uma organização palestina fundamentalista islâmica e grupo terrorista que controla a Faixa de Gaza desde 2007. Fundado em 1987 durante a Primeira Intifada, tem como objetivo declarado em sua carta fundacional a destruição de Israel e o estabelecimento de um estado islâmico na Palestina histórica. O Hamas está dividido em uma ala política e uma ala militar (Brigadas Izz ad-Din al-Qassam). É designado como organização terrorista por muitos países, incluindo Estados Unidos, União Europeia, Reino Unido e outros. O grupo é responsável por numerosos ataques contra civis israelenses, incluindo atentados suicidas, lançamentos de foguetes e túneis de infiltração.",
    fonte: "Instituto de Contraterrorismo de Israel"
  },
  {
    pergunta: "O que é o Hezbollah?",
    resposta: "O Hezbollah ('Partido de Deus') é uma organização xiita libanesa que funciona como partido político, milícia armada e organização terrorista. Fundado em 1982 durante a Guerra Civil Libanesa com apoio do Irã, tem como objetivos declarados a resistência contra Israel e a implementação de um estado islâmico no Líbano. O Hezbollah é fortemente armado, possuindo um arsenal estimado de mais de 150.000 foguetes e mísseis, e é considerado um proxy do Irã. É designado como organização terrorista por muitos países ocidentais e foi responsável por numerosos ataques contra alvos israelenses, judeus e ocidentais ao longo das décadas.",
    fonte: "Ministério da Defesa de Israel"
  },
  {
    pergunta: "O que são os Acordos de Abraão?",
    resposta: "Os Acordos de Abraão são uma série de tratados de normalização diplomática entre Israel e países árabes/muçulmanos, iniciados em 2020. Os primeiros acordos foram assinados com Emirados Árabes Unidos e Bahrein em setembro de 2020, seguidos por Sudão e Marrocos. Esses acordos representam uma mudança significativa na política regional, pois tradicionalmente a maioria dos estados árabes condicionava a normalização com Israel à resolução da questão palestina. Os acordos facilitaram cooperação econômica, segurança, tecnologia, turismo e intercâmbios culturais, criando uma nova dinâmica regional no Oriente Médio contra a influência do Irã.",
    fonte: "Ministério das Relações Exteriores de Israel"
  }
];

async function executar() {
  console.log('🚀 Iniciando adição de novas entradas à base de conhecimento...');
  
  try {
    const resultado = await addNewEntriesWithEmbeddings(novasEntradas);
    
    console.log('\n✅ Processo concluído com sucesso!');
    console.log(`📊 Estatísticas:
    - Entradas já existentes: ${resultado.totalExistentes}
    - Novas entradas adicionadas: ${resultado.totalAdicionadas}
    - Total após adição: ${resultado.totalCombinadas}`);
  } catch (error) {
    console.error('❌ Erro durante a execução:', error);
  }
}

// Executar o script
executar();
