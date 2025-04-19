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

// Fontes com URLs específicas
const NEWS_SOURCES = [
  { name: 'Jerusalem Post', url: 'https://www.jpost.com/', selector: '.article-title', linkSelector: 'a' },
  { name: 'Times of Israel', url: 'https://www.timesofisrael.com/', selector: '.headline', linkSelector: 'a' },
  { name: 'Israel Hayom', url: 'https://www.israelhayom.com/headlines/', selector: '.entry-title', linkSelector: 'a' },
  { name: 'Arutz Sheva', url: 'https://www.israelnationalnews.com/', selector: '.text-right > article h2', linkSelector: 'a' },
  { name: 'Ynet News', url: 'https://www.ynetnews.com/category/3082', selector: '.slotTitle', linkSelector: 'a' }
];

async function fetchTopHeadlines() {
  const headlines = [];
  
  for (const source of NEWS_SOURCES) {
    try {
      console.log(`📰 Buscando manchetes de ${source.name}...`);
      const response = await axios.get(source.url);
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
  const recentNewsSnapshot = await firebase.db.collection('dailyNews')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();
  
  const recentTitles = recentNewsSnapshot.docs.map(doc => doc.data().title || '');
  
  // Filtrar manchetes já enviadas recentemente
  const uniqueHeadlines = headlines.filter(h => !recentTitles.includes(h.title));
  
  // Se todas as manchetes já foram enviadas, pegar a mais recente
  if (uniqueHeadlines.length === 0) return headlines[0];
  
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
    const selectedIndex = parseInt(selection.match(/\d+/)[0]) - 1;
    
    if (selectedIndex >= 0 && selectedIndex < uniqueHeadlines.length) {
      return uniqueHeadlines[selectedIndex];
    } else {
      return uniqueHeadlines[0];
    }
  } catch (error) {
    console.error('❌ Erro ao selecionar manchete:', error.message);
    return uniqueHeadlines[0];
  }
}

// Função para extrair conteúdo do artigo (resumo)
async function fetchArticleContent(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Tenta diferentes seletores comuns para parágrafos de artigos
    const paragraphs = $('article p, .article-body p, .story-content p, .entry-content p').slice(0, 2);
    
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
    
    // Salvar a notícia no Firebase
    await saveNews(newsContent, title, "", NEWS_SOURCES[Math.floor(Math.random() * NEWS_SOURCES.length)].name);
    
    return newsContent;
  } catch (error) {
    console.error('❌ Erro ao gerar notícia por IA:', error);
    return null;
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
    return false;
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
    
    // Formatar a notícia
    let newsContent = `📰 ${selectedHeadline.title}\n\n`;
    
    // Buscar conteúdo da notícia, se tiver URL
    if (selectedHeadline.url) {
      try {
        const content = await fetchArticleContent(selectedHeadline.url);
        newsContent += `${content}\n\n`;
      } catch (error) {
        // Se falhar, gerar resumo com IA
        const summary = await generateNewsSummary(selectedHeadline.title);
        newsContent += `${summary}\n\n`;
      }
    } else {
      // Se não tiver URL, gerar resumo com IA
      const summary = await generateNewsSummary(selectedHeadline.title);
      newsContent += `${summary}\n\n`;
    }
    
    newsContent += `🔗 Leia mais: ${selectedHeadline.url || "Fonte indisponível"}\n`;
    newsContent += `Fonte: ${selectedHeadline.source}`;
    
    // Salvar a notícia no Firebase
    await saveNews(newsContent, selectedHeadline.title, selectedHeadline.url, selectedHeadline.source);
    
    return newsContent;
  } catch (error) {
    console.error('❌ Erro ao gerar notícia diária:', error);
    // Fallback para geração por IA
    return await generateAINews();
  }
}

async function sendNewsToAllUsers() {
  try {
    // Buscar a notícia mais recente
    const newsSnapshot = await firebase.db.collection('dailyNews')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    if (newsSnapshot.empty) {
      console.warn('⚠️ Nenhuma notícia disponível para envio');
      return 0;
    }
    
    const newsDoc = newsSnapshot.docs[0];
    const news = newsDoc.data();
    
    // Buscar todos os usuários ativos
    const usersSnapshot = await firebase.db.collection('conversations')
      .where('lastUpdated', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // ativos nos últimos 30 dias
      .get();
    
    console.log(`📊 Enviando notícia para ${usersSnapshot.size} usuários`);
    
    let successCount = 0;
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Verificar configuração do usuário
      const userId = userData.phone ? userData.phone.replace(/\D/g, '') : '';
      
      if (!userId) continue;
      
      try {
        const userSettingsDoc = await firebase.db.collection('userSettings').doc(userId).get();
        
        // Se usuário optou por não receber notícias, pular
        if (userSettingsDoc.exists && userSettingsDoc.data().receiveNews === false) {
          console.log(`ℹ️ Usuário ${userId} optou por não receber notícias`);
          continue;
        }
        
        // Número de telefone no formato do Twilio
        const to = userData.phone.startsWith('whatsapp:') ? userData.phone : `whatsapp:${userData.phone}`;
        
        await twilioClient.messages.create({
          body: news.content,
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
    
    // Atualizar contador de entregas
    await newsDoc.ref.update({
      delivered: firebase.admin.firestore.FieldValue.increment(successCount)
    });
    
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
