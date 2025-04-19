const { OpenAI } = require('openai');
const twilio = require('twilio');
const firebase = require('../services/firebaseService');
const domainClassifier = require('../utils/domainClassifier');
const semanticSearch = require('../utils/semanticSearch');
const responseGenerator = require('../utils/responseGenerator');
const contextManager = require('../utils/contextManager');
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
    // Dividir mensagem em partes se for muito grande
    if (mensagem.length <= WHATSAPP_CHARACTER_LIMIT) {
      await client.messages.create({
        body: mensagem,
        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
        to: para
      });
    } else {
      // Dividir em múltiplas mensagens
      const partes = [];
      for (let i = 0; i < mensagem.length; i += WHATSAPP_CHARACTER_LIMIT) {
        partes.push(mensagem.substring(i, i + WHATSAPP_CHARACTER_LIMIT));
      }
      
      // Enviar cada parte sequencialmente
      for (const parte of partes) {
        await client.messages.create({
          body: parte,
          from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
          to: para
        });
        
        // Pequeno intervalo entre mensagens
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
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
    // Extrair parâmetros do comando (ex: "/config fontes on")
    const params = comando.toLowerCase().split(' ').slice(1);
    
    if (params.length === 0) {
      // Enviar instruções de ajuda
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
    
    // Comando para configurar exibição de fontes
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
    
    // Comando não reconhecido
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

/**
 * Verifica se uma pergunta está dentro do domínio de interesse (Israel, judaísmo, etc.)
 * @param {string} pergunta - Pergunta do usuário
 * @returns {Promise<boolean>} - True se estiver no domínio
 */
async function verificarDominio(pergunta) {
  try {
    const dentroDoEscopo = await domainClassifier.classificar(pergunta);
    return dentroDoEscopo;
  } catch (error) {
    console.error('❌ Erro ao verificar domínio da pergunta:', error);
    // Em caso de erro, assumir que está no escopo para evitar frustração do usuário
    return true;
  }
}

/**
 * Busca documentos relevantes para a pergunta
 * @param {string} pergunta - Pergunta do usuário
 * @returns {Promise<Array>} - Array de documentos relevantes com pontuações
 */
async function buscarDocumentosRelevantes(pergunta) {
  try {
    return await semanticSearch.buscar(pergunta);
  } catch (error) {
    console.error('❌ Erro ao buscar documentos relevantes:', error);
    return [];
  }
}

/**
 * Gera resposta baseada em documentos e contexto
 * @param {string} pergunta - Pergunta do usuário
 * @param {Array} documentos - Documentos relevantes
 * @param {Array} historicoConversa - Histórico recente da conversa
 * @param {Object} userSettings - Configurações do usuário
 * @returns {Promise<string>} - Resposta gerada
 */
async function gerarResposta(pergunta, documentos, historicoConversa, userSettings) {
  try {
    return await responseGenerator.gerar(pergunta, documentos, historicoConversa, userSettings);
  } catch (error) {
    console.error('❌ Erro ao gerar resposta:', error);
    return "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.";
  }
}

/**
 * Função principal para processar mensagens recebidas
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 * @returns {Promise<void>}
 */
async function processarMensagem(req, res) {
  try {
    const mensagem = req.body.Body;
    const telefone = req.body.From;
    
    // Resposta imediata para o Twilio
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
    
    // Feedback imediato para o usuário
    await enviarMensagem(twilioClient, telefone, "Estou pensando...");
    
    // Processar comandos especiais
    if (mensagem.startsWith('/config')) {
      await processarComandoConfig(telefone, mensagem);
      return;
    }
    
    // Obter histórico recente da conversa
    const historicoConversa = await firebase.obterHistoricoRecente(telefone, 5);
    
    // Obter configurações do usuário
    const userSettings = await firebase.getUserSettings(telefone);
    
    // Verificar se a pergunta está no domínio relevante
    const dentroDoEscopo = await verificarDominio(mensagem);
    
    if (!dentroDoEscopo) {
      await enviarMensagem(
        twilioClient,
        telefone,
        "Desculpe, não estou apto a responder perguntas fora do escopo de Israel, judaísmo e temas relacionados."
      );
      return;
    }
    
    // Buscar documentos relevantes
    const documentosRelevantes = await buscarDocumentosRelevantes(mensagem);
    
    // Gerar resposta
    const resposta = await gerarResposta(mensagem, documentosRelevantes, historicoConversa, userSettings);
    
    // Enviar resposta
    await enviarMensagem(twilioClient, telefone, resposta);
    
    // Salvar no histórico
    const documentosUsados = documentosRelevantes.map(doc => doc.id);
    await firebase.salvarHistoricoConversa(telefone, mensagem, resposta, documentosUsados);
    
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    
    try {
      // Tentar enviar mensagem de erro para o usuário
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
