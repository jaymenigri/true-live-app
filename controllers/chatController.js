const twilio = require('twilio');
const MessagingResponse = twilio.twiml.MessagingResponse;
const { generateResponse } = require('../utils/responseGenerator');
const { dividirResposta } = require('../utils/splitter');
const firebase = require('../services/firebaseService');
require('dotenv').config();

async function handleMessage(req, res) {
  const twiml = new MessagingResponse();
  
  try {
    console.log('📨 Webhook acionado!', new Date().toISOString());
    const texto = req.body.Body;
    const telefone = req.body.From;
    console.log('📝 Mensagem recebida:', texto);
    console.log('📱 De:', telefone);

    // Resposta imediata para evitar timeout do webhook
    twiml.message('🔍 Analisando sua pergunta...');
    res.type('text/xml').send(twiml.toString());
    
    // Processar a resposta após enviar a confirmação inicial
    setTimeout(async () => {
      await processarResposta(texto, telefone);
    }, 100);
    
    return;
  } catch (erro) {
    console.error('❌ Erro ao processar webhook:', erro);
    twiml.message('⚠️ Erro interno no servidor.');
    res.type('text/xml').send(twiml.toString());
  }
}

async function processarResposta(texto, telefone) {
  try {
    // Salvar mensagem do usuário no histórico
    await firebase.saveConversation(telefone, texto, true);
    
    // Buscar histórico recente para contexto
    const historico = await firebase.getConversationHistory(telefone, 5);
    
    // Gerar resposta com o sistema RAG
    const resultado = await generateResponse(texto, historico);
    
    // Salvar resposta no histórico
    await firebase.saveConversation(telefone, resultado.response, false);
    
    // Configurar cliente Twilio para envio de mensagens
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    // Dividir resposta em partes, se necessário
    const respostas = dividirResposta(resultado.response, 1000);
    
    // Se houver múltiplas partes, avisar o usuário
    if (respostas.length > 1) {
      await enviarMensagem(
        twilioClient, 
        telefone, 
        `📄 A resposta tem ${respostas.length} partes. Enviando agora...`
      );
    }
    
    // Enviar cada parte da resposta com um pequeno intervalo
    for (let i = 0; i < respostas.length; i++) {
      await enviarMensagem(twilioClient, telefone, respostas[i]);
      
      // Pequeno intervalo entre mensagens para evitar problemas de ordem
      if (i < respostas.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('✅ Resposta enviada com sucesso!');
  } catch (erro) {
    console.error('❌ Erro ao processar resposta:', erro);
    
    // Tentar enviar mensagem de erro
    try {
      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      await enviarMensagem(
        twilioClient,
        telefone,
        "Desculpe, encontrei um problema ao processar sua pergunta. Por favor, tente novamente."
      );
    } catch (e) {
      console.error('❌ Erro ao enviar mensagem de erro:', e);
    }
  }
}

async function enviarMensagem(client, para, mensagem) {
  try {
    await client.messages.create({
      body: mensagem,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER || '+14155238886'}`,
      to: para
    });
    return true;
  } catch (erro) {
    console.error('❌ Erro ao enviar mensagem:', erro);
    return false;
  }
}

module.exports = { handleMessage };
