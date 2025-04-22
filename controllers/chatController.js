const { OpenAI } = require('openai');
const twilio = require('twilio');
const firebase = require('../services/firebaseService');
const domainClassifier = require('../utils/domainClassifier');
const semanticSearch = require('../utils/semanticSearch');
const responseGenerator = require('../utils/responseGenerator');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Limite máximo de caracteres para mensagens do WhatsApp
const WHATSAPP_CHARACTER_LIMIT = 1600;

/**
 * Envia uma mensagem via WhatsApp, dividindo-a se necessário
 * @param {Object} client - Cliente Twilio
 * @param {string} para - Número de telefone de destino
 * @param {string} mensagem - Conteúdo da mensagem
 * @returns {Promise<boolean>} - Sucesso do envio
 */
async function enviarMensagem(client, para, mensagem) {
  try {
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    // Verificação da variável de ambiente
    if (!fromNumber || !fromNumber.startsWith('whatsapp:+')) {
      console.error('❌ TWILIO_PHONE_NUMBER inválido ou não configurado. Verifique as variáveis de ambiente no Heroku.');
      return false;
    }

    // Dividir mensagem em partes se for muito grande
    const partes = [];
    if (mensagem.length <= WHATSAPP_CHARACTER_LIMIT) {
      partes.push(mensagem);
    } else {
      for (let i = 0; i < mensagem.length; i += WHATSAPP_CHARACTER_LIMIT) {
        partes.push(mensagem.substring(i, i + WHATSAPP_CHARACTER_LIMIT));
      }
    }

    // Enviar cada parte sequencialmente
    for (const parte of partes) {
      console.log(`📤 Enviando mensagem para ${para} via ${fromNumber}`);
      await client.messages.create({
        body: parte,
        from: fromNumber,
        to: para
      });
      await new Promise(resolve => setTimeout(resolve, 500)); // intervalo entre partes
    }

    return true;
  } catch (error) {
    if (error.code === 21212) {
      console.error(`❌ [Twilio Error 21212] Número 'From' inválido: ${process.env.TWILIO_PHONE_NUMBER}`);
      console.error('➡️ Dica: Verifique se a sandbox está ativa e se o destinatário enviou a mensagem "join [código]" para o número do Twilio.');
    } else {
      console.error('❌ Erro ao enviar mensagem:', error);
    }
    return false;
  }
}

/**
 * Processa comandos de configuração como "/config fontes on"
 * @param {string} telefone - Número de telefone do usuário
 * @param {string} comando - Comando completo recebido
 * @returns {Promise<void>}
 */
async function processarComandoConfig(telefone, comando) {
  try {
    const params = comando.toLowerCase().split(' ').slice(1);

    if (params.length === 0) {
      await enviarMensagem(
        twilioClient,
        telefone,
        `🔧 Comandos de configuração disponíveis:

/config fontes on - Ativar exibição de fontes
/config fontes off - Desativar exibição de fontes
/config noticias on - Ativar recebimento de notícias
/config noticias off - Desativar recebimento de notícias`
      );
      return;
    }

    if (params.includes('fontes') || params.includes('sources')) {
      const showSources = params.includes('on') || params.includes('sim') || params.includes('yes');
      await firebase.updateUserSettings(telefone, { showSources });
      await enviarMensagem(
        twilioClient,
        telefone,
        `✅ Configuração atualizada: exibição de fontes ${showSources ? 'ativada' : 'desativada'}.`
      );
      return;
    }

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

    await enviarMensagem(
      twilioClient,
      telefone,
      `❓ Comando de configuração não reconhecido. Digite /config para ver os comandos disponíveis.`
    );
  } catch (error) {
    console.error('❌ Erro ao processar comando de configuração:', error);
    await enviarMensagem(
      twilioClient,
      telefone,
      `❌ Erro ao processar comando. Por favor, tente novamente.`
    );
  }
}

async function verificarDominio(pergunta) {
  try {
    return await domainClassifier.classificar(pergunta);
  } catch (error) {
    console.error('❌ Erro ao verificar domínio da pergunta:', error);
    return true;
  }
}

async function buscarDocumentosRelevantes(pergunta) {
  try {
    return await semanticSearch.buscar(pergunta);
  } catch (error) {
    console.error('❌ Erro ao buscar documentos relevantes:', error);
    return [];
  }
}

async function gerarResposta(pergunta, documentos, historicoConversa, userSettings) {
  try {
    return await responseGenerator.gerar(pergunta, documentos, historicoConversa, userSettings);
  } catch (error) {
    console.error('❌ Erro ao gerar resposta:', error);
    return "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.";
  }
}

async function processarMensagem(req, res) {
  try {
    const mensagem = req.body.Body;
    const telefone = req.body.From;

    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');

    await enviarMensagem(twilioClient, telefone, "Estou pensando...");

    if (mensagem.startsWith('/config')) {
      await processarComandoConfig(telefone, mensagem);
      return;
    }

    const historicoConversa = await firebase.obterHistoricoRecente(telefone, 5);
    const userSettings = await firebase.getUserSettings(telefone);

    const dentroDoEscopo = await verificarDominio(mensagem);

    if (!dentroDoEscopo) {
      await enviarMensagem(
        twilioClient,
        telefone,
        "Desculpe, não estou apto a responder perguntas fora do escopo de Israel, judaísmo e temas relacionados."
      );
      return;
    }

    const documentosRelevantes = await buscarDocumentosRelevantes(mensagem);
    const resposta = await gerarResposta(mensagem, documentosRelevantes, historicoConversa, userSettings);
    await enviarMensagem(twilioClient, telefone, resposta);

    const documentosUsados = documentosRelevantes.map(doc => doc.id);
    await firebase.salvarHistoricoConversa(telefone, mensagem, resposta, documentosUsados);
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    try {
      await enviarMensagem(
        twilioClient,
        req.body.From,
        "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente."
      );
    } catch (innerError) {
      console.error('❌ Erro ao enviar mensagem de erro:', innerError);
    }
  }
}

module.exports = {
  processarMensagem,
  enviarMensagem
};
