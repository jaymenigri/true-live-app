const firebase = require('../services/firebaseService');
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

  await twilioClient.messages.create({
    body: `🤖 Comando não reconhecido. Envie /config para ver as opções disponíveis.`,
    from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
    to: telefone
  });

  res.send('<Response></Response>');
}

async function processarComandoConfig(telefone, mensagem) {
  const params = mensagem.split(/\s+/).slice(1); // remove o /config

  // Comando para configurar recebimento de notícias
  if (params.includes('noticias') || params.includes('news')) {
    const receiveNews = params.includes('on') || params.includes('sim') || params.includes('yes');
    await firebase.updateUserSettings(telefone, { receiveNews });

    await twilioClient.messages.create({
      body: `✅ Configuração atualizada: recebimento de notícias ${receiveNews ? 'ativado' : 'desativado'}.`,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: telefone
    });

    return;
  }

  // Mensagem padrão de ajuda
  await twilioClient.messages.create({
    body: `🔧 Comandos de configuração disponíveis:

/config fontes on - Ativar exibição de fontes
/config fontes off - Desativar exibição de fontes
/config noticias on - Ativar recebimento de notícias
/config noticias off - Desativar recebimento de notícias`,
    from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
    to: telefone
  });
}

module.exports = {
  handleMessage
};
