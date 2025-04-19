const { generateDailyNews, sendNewsToAllUsers } = require('../services/newsService');
require('dotenv').config();

async function runEveningNews() {
  try {
    console.log('🌙 Iniciando envio de notícias noturnas');
    
    // Gerar nova notícia
    const news = await generateDailyNews();
    
    if (news) {
      // Enviar para todos os usuários
      const sentCount = await sendNewsToAllUsers();
      console.log(`📊 Notícia noturna enviada para ${sentCount} usuários`);
    }
  } catch (error) {
    console.error('❌ Erro no envio de notícias noturnas:', error);
  }
}

// Executar
runEveningNews();
