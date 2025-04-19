const firebase = require('../services/firebaseService');
const { enviarMensagem } = require('../utils/mensagemUtils');
const twilio = require('twilio');
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function handleMessage(req, res) {
  const telefone = req.body.From;
  const mensagem = req.body.Body.trim().toLowerCase();

  console.log(`📩 Mensagem recebida de ${telefone}: ${mensagem}`);

  if (mensagem.startsWith('/config')) {
    await processarComandoConfig(telefone, mensagem);
    return res.send('<Response></Response>');
  }

  // Aqui seguem outras rotinas do seu chatbot...
  await enviarMensagem(
    twilioClient,
    telefone,
    `🤖 Comando não reconhecido. Envie /config para ver as opções disponíveis.`
  );
  res.send('<Response></Response>');
}

async function processarComandoConfig(telefone, mensagem) {
  const params = mensagem.split(/\s+/).slice(1); // remove o /config

  // Comando para configurar recebimento de notícias
  if (params.includes('noticias') || params.includes('news')) {
    const receiveNews = params.includes('on') || params.includes('sim') || params.includes('yes');
    await firebase.updateUserSettings(telefone, { receiveNews });

    await enviarMensagem(
      twilioClient,
      telefone,
      `✅ Configuração atualizada: recebimento de notícias ${receiveNews ? 'ativado' : 'desativado'}.`
    );
    return;
  }

  // Mensagem padrão de ajuda se nenhum parâmetro válido for fornecido
  await enviarMensagem(
    twilioClient,
    telefone,
    `🔧 Comandos de configuração disponíveis:
    
/config fontes on - Ativar exibição de fontes
/config fontes off - Desativar exibição de fontes
/config noticias on - Ativar recebimento de notícias
/config noticias off - Desativar recebimento de notícias`
  );
}

module.exports = {
  handleMessage
};
