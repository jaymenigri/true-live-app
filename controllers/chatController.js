const { OpenAI } = require('openai');
const twilio = require('twilio');
const firebase = require('../services/firebaseService');
const domainClassifier = require('../utils/domainClassifier');
const semanticSearch = require('../utils/semanticSearch');
const responseGenerator = require('../utils/responseGenerator');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

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
    // Garantir que o número está no formato correto para o WhatsApp
    const paraFormatado = para.startsWith('whatsapp:') ? para : `whatsapp:${para}`;
    const fromNumber = `whatsapp:${process.env.TWILIO_PHONE_NUMBER || '+14155238886'}`;
    
    console.log(`📤 Enviando mensagem para ${paraFormatado} via ${fromNumber}`);
    
    // Dividir mensagem em partes se for muito grande
    if (mensagem.length <= WHATSAPP_CHARACTER_LIMIT) {
      console.log(`📨 Enviando mensagem única (${mensagem.length} caracteres)`);
      const message = await client.messages.create({
        body: mensagem,
        from: fromNumber,
        to: paraFormatado
      });
      console.log(`✅ Mensagem enviada com sucesso - SID: ${message.sid}`);
    } else {
      // Dividir em múltiplas mensagens
      const partes = [];
      for (let i = 0; i < mensagem.length; i += WHATSAPP_CHARACTER_LIMIT) {
        partes.push(mensagem.substring(i, i + WHATSAPP_CHARACTER_LIMIT));
      }
      
      console.log(`📨 Enviando mensagem dividida em ${partes.length} partes`);
      
      // Enviar cada parte sequencialmente
      for (let i = 0; i < partes.length; i++) {
        const parte = partes[i];
        console.log(`📤 Enviando parte ${i+1}/${partes.length} (${parte.length} caracteres)`);
        
        const message = await client.messages.create({
          body: parte,
          from: fromNumber,
          to: paraFormatado
        });
        
        console.log(`✅ Parte ${i+1} enviada com sucesso - SID: ${message.sid}`);
        
        // Pequeno intervalo entre mensagens
        if (i < partes.length - 1) {
          console.log(`⏱️ Aguardando intervalo entre mensagens...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    console.error('❌ Detalhes do erro:', JSON.stringify({
      mensagem: mensagem ? mensagem.substring(0, 100) + "..." : "undefined",
      para: para,
      erro: error.message,
      codigo: error.code,
      status: error.status
    }));
    
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
 * Função principal para processar mensagens recebidas
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 * @returns {Promise<void>}
 */
async function processarMensagem(req, res) {
  try {
    const mensagem = req.body.Body;
    const telefone = req.body.From;
    
    console.log(`📩 Mensagem recebida de ${telefone}: "${mensagem.substring(0, 50)}${mensagem.length > 50 ? '...' : ''}"`);
    
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
    console.log(`📚 Histórico recuperado: ${historicoConversa.length} mensagens anteriores`);
    
    // Obter configurações do usuário
    let userSettings = {};
    try {
      userSettings = await firebase.getUserSettings(telefone);
      console.log(`⚙️ Configurações do usuário recuperadas:`, userSettings);
    } catch (error) {
      console.error('⚠️ Erro ao recuperar configurações do usuário, usando padrões:', error);
      userSettings = { showSources: false, language: 'pt', responseLength: 'medium' };
    }
    
    // Verificar se a pergunta está no domínio relevante
    console.log(`🔍 Classificando pergunta: "${mensagem}"`);
    const dentroDoEscopo = await verificarDominio(mensagem);
    console.log(`📊 Classificação: ${dentroDoEscopo ? 'Dentro do domínio' : 'Fora do domínio'}`);
    
    if (!dentroDoEscopo) {
      await enviarMensagem(
        twilioClient,
        telefone,
        "Desculpe, não estou apto a responder perguntas fora do escopo de Israel, judaísmo e temas relacionados."
      );
      return;
    }
    
    // Buscar documentos relevantes
    console.log(`🔎 Buscando documentos para: "${mensagem}"`);
    const documentosRelevantes = await buscarDocumentosRelevantes(mensagem);
    
    documentosRelevantes.forEach((doc, i) => {
      console.log(`📄 #${i+1}: "${doc.titulo?.substring(0, 30)}..." (${doc.score.toFixed(3)})`);
    });
    
    // Preparar para gerar resposta
    console.log(`🤔 Gerando resposta para: "${mensagem}"`);
    
    // Gerar resposta
    let resposta;
    try {
      resposta = await gerarResposta(mensagem, documentosRelevantes, historicoConversa, userSettings);
      console.log(`✅ Resposta gerada: ${resposta.length} caracteres`);
    } catch (error) {
      console.error('❌ Erro ao gerar resposta:', error);
      resposta = "Desculpe, ocorreu um erro ao gerar a resposta. Por favor, tente reformular sua pergunta.";
    }
    
    // Enviar resposta
    console.log(`📤 Enviando resposta final (${resposta.length} caracteres)`);
    const enviado = await enviarMensagem(twilioClient, telefone, resposta);
    
    if (enviado) {
      console.log(`✅ Resposta enviada com sucesso para ${telefone}`);
    } else {
      console.error(`❌ Falha ao enviar resposta para ${telefone}`);
      // Tentar novamente com uma mensagem mais simples
      await enviarMensagem(
        twilioClient,
        telefone,
        "Desculpe, ocorreu um erro ao enviar a resposta completa. Por favor, tente novamente."
      );
    }
    
    // Salvar no histórico
    const documentosUsados = documentosRelevantes.map(doc => doc.id);
    await firebase.salvarHistoricoConversa(telefone, mensagem, resposta, documentosUsados);
    console.log(`✅ Histórico salvo para usuário ${telefone.replace(/\D/g, '')}`);
    
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
    throw error;
  }
}

module.exports = {
  processarMensagem,
  enviarMensagem
};
