const axios = require('axios');
const cheerio = require('cheerio');
const { OpenAI } = require('openai');
const firebase = require('./firebaseService');
const twilio = require('twilio');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Headers para simular um navegador real
const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0'
};

// Fontes com URLs específicas
const NEWS_SOURCES = [
  { name: 'Jerusalem Post', url: 'https://www.jpost.com/', selector: '.article-title, .headline, h2.title', linkSelector: 'a' },
  { name: 'Times of Israel', url: 'https://www.timesofisrael.com/', selector: '.headline, .article-title, h2.title', linkSelector: 'a' },
  { name: 'Israel Hayom', url: 'https://www.israelhayom.com/', selector: '.entry-title, .article-title, h2.title', linkSelector: 'a' },
  { name: 'Arutz Sheva', url: 'https://www.israelnationalnews.com/', selector: 'h2, .article-title, .headline', linkSelector: 'a' },
  { name: 'Ynet News', url: 'https://www.ynetnews.com/', selector: '.slotTitle, .title, h2', linkSelector: 'a' }
];

async function fetchTopHeadlines() {
  const headlines = [];
  
  for (const source of NEWS_SOURCES) {
    try {
      console.log(`📰 Buscando manchetes de ${source.name}...`);
      const response = await axios.get(source.url, { 
        headers: browserHeaders,
        timeout: 10000 // 10 segundos de timeout
      });
      
      const $ = cheerio.load(response.data);
      
      // Extrair manchete principal e link
      const headlineElement = $(source.selector).first();
      const headline = headlineElement.text().trim();
      
      let link = '';
      if (source.linkSelector) {
        link = headlineElement.find(source.linkSelector).attr('href') || 
              headlineElement.closest(source.linkSelector).attr('href') || '';
        
        // Adicionar domínio se for URL relativa
        if (link && !link.startsWith('http')) {
          const baseUrl = new URL(source.url);
          link = `${baseUrl.origin}${link.startsWith('/') ? '' : '/'}${link}`;
        }
      }
      
      if (headline) {
        headlines.push({
          title: headline,
          source: source.name,
          url: link,
          timestamp: new Date().toISOString()
        });
        console.log(`✅ Manchete obtida: "${headline.substring(0, 50)}..."`);
      }
    } catch (error) {
      console.error(`❌ Erro ao buscar manchetes de ${source.name}:`, error.message);
    }
  }
  
  return headlines;
}

// Função para selecionar a melhor notícia com base em relevância
async function selectBestHeadline(headlines) {
  if (headlines.length === 0) return null;
  
  // Se tiver apenas 1 manchete, usar ela
  if (headlines.length === 1) return headlines[0];
  
  // Verificar notícias já enviadas recentemente para evitar repetição
  let recentTitles = [];
  try {
    const recentNewsSnapshot = await firebase.db.collection('dailyNews')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    recentTitles = recentNewsSnapshot.docs.map(doc => doc.data().title || '');
  } catch (error) {
    console.error('❌ Erro ao buscar notícias recentes:', error.message);
    // Continuar mesmo com erro, apenas não haverá verificação de duplicatas
  }
  
  // Filtrar manchetes já enviadas recentemente
  const uniqueHeadlines = headlines.filter(h => !recentTitles.includes(h.title));
  
  // Se todas as manchetes já foram enviadas, pegar a mais recente
  if (uniqueHeadlines.length === 0) return headlines[0];
  
  // Se houver apenas uma manchete única, use-a diretamente
  if (uniqueHeadlines.length === 1) return uniqueHeadlines[0];
  
  // Usar a OpenAI para determinar a manchete mais relevante
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Você é um editor especializado em notícias sobre Israel.
          Selecione a manchete mais relevante da lista abaixo com base nos seguintes critérios:
          1. Relevância para o público interessado em Israel
          2. Atualidade e importância do tema
          3. Impacto potencial do evento
          
          Responda APENAS com o número da manchete selecionada (ex: 1, 2, 3, etc.)`
        },
        {
          role: "user",
          content: uniqueHeadlines.map((h, i) => `${i+1}. ${h.title} (${h.source})`).join('\n')
        }
      ],
      temperature: 0.3,
      max_tokens: 5
    });
    
    const selection = response.choices[0].message.content.trim();
    const match = selection.match(/\d+/);
    
    if (match) {
      const selectedIndex = parseInt(match[0]) - 1;
      if (selectedIndex >= 0 && selectedIndex < uniqueHeadlines.length) {
        return uniqueHeadlines[selectedIndex];
      }
    }
    
    // Se não conseguir extrair um número válido, usar a primeira manchete
    return uniqueHeadlines[0];
  } catch (error) {
    console.error('❌ Erro ao selecionar manchete:', error.message);
    return uniqueHeadlines[0];
  }
}

// Função para extrair conteúdo do artigo (resumo)
async function fetchArticleContent(url) {
  try {
    const response = await axios.get(url, { 
      headers: browserHeaders,
      timeout: 10000 // 10 segundos de timeout
    });
    
    const $ = cheerio.load(response.data);
    
    // Tenta diferentes seletores comuns para parágrafos de artigos
    const paragraphs = $('article p, .article-body p, .story-content p, .entry-content p, .article-content p, p').slice(0, 3);
    
    if (paragraphs.length === 0) {
      throw new Error("Não foi possível extrair o conteúdo do artigo");
    }
    
    let content = '';
    paragraphs.each((i, el) => {
      content += $(el).text().trim() + ' ';
    });
    
    return content.trim();
  } catch (error) {
    console.error(`❌ Erro ao extrair conteúdo do artigo:`, error.message);
    throw error;
  }
}

// Função para gerar resumo da notícia usando IA
async function generateNewsSummary(title) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Você é um jornalista especializado em notícias sobre Israel.
          Com base no título fornecido, crie um breve resumo factual (2-3 frases) sobre o assunto.
          Mantenha uma perspectiva pró-Israel e seja objetivo.`
        },
        {
          role: "user",
          content: title
        }
      ],
      temperature: 0.5,
      max_tokens: 150
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Erro ao gerar resumo da notícia:', error.message);
    return "Detalhes desta notícia não estão disponíveis no momento.";
  }
}

// Função de fallback para geração de notícias por IA
async function generateAINews() {
  try {
    console.log('🤖 Usando geração de notícias por IA como fallback...');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Você é um editor de notícias especializado em Israel e Oriente Médio.
          
          Crie uma notícia curta (máximo 500 caracteres) sobre um desenvolvimento importante recente relacionado a Israel.
          A notícia deve ser factual, atual e seguir uma perspectiva pró-Israel.
          
          Inclua:
          1. Um título chamativo (começando com "📰 ")
          2. O corpo da notícia, conciso e informativo
          3. Um encerramento com "Fonte: [Nome da fonte]" usando uma destas fontes: ${NEWS_SOURCES.map(s => s.name).join(', ')}
          
          A notícia deve ser relevante para o dia atual (${new Date().toISOString().split('T')[0]}).`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    const newsContent = response.choices[0].message.content.trim();
    
    // Extrair título da notícia gerada pela IA
    const titleMatch = newsContent.match(/^📰\s*(.+?)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "Notícia do dia";
    
    try {
      // Salvar a notícia no Firebase
      await saveNews(newsContent, title, "", NEWS_SOURCES[Math.floor(Math.random() * NEWS_SOURCES.length)].name);
    } catch (error) {
      console.error('❌ Erro ao salvar notícia gerada por IA:', error.message);
      // Continuar mesmo com erro ao salvar
    }
    
    return newsContent;
  } catch (error) {
    console.error('❌ Erro ao gerar notícia por IA:', error);
    return "📰 Notícias de Israel\n\nHouve um problema ao gerar as notícias de hoje. Estamos trabalhando para resolver o problema o mais rápido possível.\n\nEquipe True Live";
  }
}

async function saveNews(content, title, url, source) {
  try {
    const newsDoc = {
      content,
      title: title || "",
      url: url || "",
      source: source || "",
      timestamp: new Date().toISOString(),
      delivered: 0,
      reactions: {
        like: 0,
        dislike: 0
      }
    };
    
    await firebase.db.collection('dailyNews').add(newsDoc);
    console.log('✅ Notícia salva no Firebase');
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar notícia:', error);
    throw error; // Propagar erro para tratamento adequado
  }
}

async function generateDailyNews() {
  try {
    console.log('🗞️ Gerando notícia diária...');
    
    // Buscar manchetes reais
    const headlines = await fetchTopHeadlines();
    
    if (headlines.length === 0) {
      console.warn('⚠️ Nenhuma manchete encontrada, usando geração por IA');
      return await generateAINews();
    }
    
    // Selecionar a melhor manchete
    const selectedHeadline = await selectBestHeadline(headlines);
    
    if (!selectedHeadline) {
      console.warn('⚠️ Falha ao selecionar manchete, usando geração por IA');
      return await generateAINews();
    }
    
    // Formatar a notícia
    let newsContent = `📰 ${selectedHeadline.title}\n\n`;
    
    // Buscar conteúdo da notícia, se tiver URL
    let contentObtained = false;
    if (selectedHeadline.url) {
      try {
        const content = await fetchArticleContent(selectedHeadline.url);
        if (content && content.length > 20) { // Verificar se o conteúdo é substancial
          newsContent += `${content}\n\n`;
          contentObtained = true;
        }
      } catch (error) {
        // Erro será registrado dentro da função fetchArticleContent
        // Continuar para o fallback
      }
    }
    
    // Se não conseguiu obter conteúdo, gerar resumo com IA
    if (!contentObtained) {
      try {
        const summary = await generateNewsSummary(selectedHeadline.title);
        newsContent += `${summary}\n\n`;
      } catch (error) {
        // Se falhar ao gerar resumo, adicionar mensagem genérica
        newsContent += "Este é um desenvolvimento importante relacionado a Israel. Leia mais detalhes no link abaixo.\n\n";
      }
    }
    
    // Adicionar link e fonte
    newsContent += `🔗 Leia mais: ${selectedHeadline.url || "Fonte indisponível"}\n`;
    newsContent += `Fonte: ${selectedHeadline.source}`;
    
    try {
      // Salvar a notícia no Firebase
      await saveNews(newsContent, selectedHeadline.title, selectedHeadline.url, selectedHeadline.source);
    } catch (error) {
      // Continuar mesmo com erro ao salvar
      console.error('❌ Erro ao salvar notícia, mas continuando com o envio:', error.message);
    }
    
    return newsContent;
  } catch (error) {
    console.error('❌ Erro ao gerar notícia diária:', error);
    // Fallback para geração por IA
    try {
      return await generateAINews();
    } catch (innerError) {
      // Fallback final se tudo falhar
      console.error('❌ Erro no fallback de IA:', innerError);
      return "📰 Notícias de Israel\n\nHouve um problema ao gerar as notícias de hoje. Estamos trabalhando para resolver o problema o mais rápido possível.\n\nEquipe True Live";
    }
  }
}

async function sendNewsToAllUsers() {
  try {
    let newsContent = null;
    
    // Buscar a notícia mais recente
    try {
      const newsSnapshot = await firebase.db.collection('dailyNews')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
      
      if (!newsSnapshot.empty) {
        const newsDoc = newsSnapshot.docs[0];
        const news = newsDoc.data();
        newsContent = news.content;
      }
    } catch (error) {
      console.error('❌ Erro ao buscar notícia do Firebase:', error.message);
    }
    
    // Se não encontrou notícia no Firebase, gerar uma nova
    if (!newsContent) {
      console.warn('⚠️ Nenhuma notícia disponível no Firebase, gerando uma nova');
      newsContent = await generateDailyNews();
      
      if (!newsContent) {
        console.error('❌ Não foi possível gerar uma notícia');
        return 0;
      }
    }
    
    // Buscar todos os usuários ativos
    let usersData = [];
    try {
      const usersSnapshot = await firebase.db.collection('conversations')
        .where('lastUpdated', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // ativos nos últimos 30 dias
        .get();
      
      console.log(`📊 Encontrados ${usersSnapshot.size} usuários ativos`);
      usersData = usersSnapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error('❌ Erro ao buscar usuários:', error.message);
      return 0;
    }
    
    if (usersData.length === 0) {
      console.warn('⚠️ Nenhum usuário ativo encontrado');
      return 0;
    }
    
    console.log(`📊 Enviando notícia para ${usersData.length} usuários`);
    
    let successCount = 0;
    for (const userData of usersData) {
      // Verificar se userData e userData.phone existem
      if (!userData || !userData.phone) {
        console.warn('⚠️ Dados de usuário inválidos:', userData);
        continue;
      }
      
      // Verificar configuração do usuário
      const userId = userData.phone.replace(/\D/g, '');
      
      try {
        // Verificar se o usuário optou por não receber notícias
        let receiveNews = true; // Por padrão, recebe notícias
        
        try {
          const userSettingsDoc = await firebase.db.collection('userSettings').doc(userId).get();
          if (userSettingsDoc.exists && userSettingsDoc.data().receiveNews === false) {
            console.log(`ℹ️ Usuário ${userId} optou por não receber notícias`);
            continue;
          }
        } catch (error) {
          console.warn(`⚠️ Erro ao verificar configurações do usuário ${userId}, assumindo padrão:`, error.message);
          // Continuar com o padrão (recebeNews = true)
        }
        
        // Número de telefone no formato do Twilio
        const to = userData.phone.startsWith('whatsapp:') ? userData.phone : `whatsapp:${userData.phone}`;
        
        await twilioClient.messages.create({
          body: newsContent,
          from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
          to: to
        });
        
        successCount++;
        
        // Pequeno intervalo para não sobrecarregar o Twilio
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Erro ao enviar notícia para ${userId}:`, error.message);
      }
    }
    
    // Tentar atualizar contador de entregas
    try {
      const newsSnapshot = await firebase.db.collection('dailyNews')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
      
      if (!newsSnapshot.empty) {
        const newsDoc = newsSnapshot.docs[0];
        await newsDoc.ref.update({
          delivered: firebase.admin.firestore.FieldValue.increment(successCount)
        });
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar contador de entregas:', error.message);
      // Continuar mesmo com erro
    }
    
    console.log(`✅ Notícia enviada com sucesso para ${successCount} usuários`);
    return successCount;
  } catch (error) {
    console.error('❌ Erro ao enviar notícias:', error);
    return 0;
  }
}

module.exports = {
  generateDailyNews,
  sendNewsToAllUsers
};
