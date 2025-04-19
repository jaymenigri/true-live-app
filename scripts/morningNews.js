const { generateDailyNews, sendNewsToAllUsers } = require('../services/newsService');
require('dotenv').config();

async function runMorningNews() {
  try {
    console.log('🌞 Iniciando envio de notícias matinais');
    
    // Gerar nova notícia
    const news = await generateDailyNews();
    
    if (news) {
      // Enviar para todos os usuários
      const sentCount = await sendNewsToAllUsers();
      console.log(`📊 Notícia matinal enviada para ${sentCount} usuários`);
    }
  } catch (error) {
    console.error('❌ Erro no envio de notícias matinais:', error);
  }
}

// Executar
runMorningNews();
