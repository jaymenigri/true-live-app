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
    
    // Corrigido: Não duplicar o prefixo whatsapp:
    const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+14155238886';
    const fromFormatado = fromNumber.startsWith('whatsapp:') 
      ? fromNumber 
      : `whatsapp:${fromNumber}`;
    
    console.log(`📤 Enviando mensagem para ${paraFormatado} via ${fromFormatado}`);
    
    // Verificar se a mensagem é válida
    if (!mensagem || typeof mensagem !== 'string' || mensagem.length === 0) {
      console.error('❌ Tentativa de envio de mensagem inválida:', mensagem);
      return false;
    }
    
    // Dividir mensagem em partes se for muito grande
    if (mensagem.length <= WHATSAPP_CHARACTER_LIMIT) {
      console.log(`📨 Enviando mensagem única (${mensagem.length} caracteres)`);
      const message = await client.messages.create({
        body: mensagem,
        from: fromFormatado,
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
          from: fromFormatado,
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
    
    // Obter histórico recente da conversa - aumentar para mais mensagens para melhor contexto
    const historicoConversa = await firebase.obterHistoricoRecente(telefone, 10);
    console.log(`📚 Histórico recuperado: ${historicoConversa.length} mensagens anteriores`);
    
    // Log detalhado do histórico para debug
    if (historicoConversa.length > 0) {
      console.log('🔍 Histórico da conversa:');
      historicoConversa.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${msg.pergunta ? 'Pergunta: ' + msg.pergunta.substring(0, 50) : 'Mensagem'}`);
      });
    }
    
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
    
    // Se houver histórico, classifique considerando o contexto
    let dentroDoEscopo = false;
    if (historicoConversa.length > 0) {
      // Preparar contexto estruturado para o classificador
      let contextoPergunta = "CONVERSA ANTERIOR:\n\n";
      historicoConversa.slice(-3).forEach(msg => {  // Últimas 3 mensagens para contexto
        if (msg.pergunta && msg.resposta) {
          // Extrair texto se resposta for objeto
          let respostaText = msg.resposta;
          if (typeof msg.resposta === 'object') {
            respostaText = msg.resposta.response || msg.resposta.text || JSON.stringify(msg.resposta);
          }
          contextoPergunta += `Usuário: ${msg.pergunta}\nAssistente: ${respostaText}\n\n`;
        }
      });
      contextoPergunta += `Usuário: ${mensagem}`;
      
      dentroDoEscopo = await verificarDominio(contextoPergunta);
    } else {
      // Sem histórico, classifique apenas a pergunta
      dentroDoEscopo = await verificarDominio(mensagem);
    }
    
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
    
    // Verificação segura de propriedades dos documentos
    if (documentosRelevantes && documentosRelevantes.length > 0) {
      documentosRelevantes.forEach((doc, i) => {
        const titulo = doc.titulo || doc.title || 'Documento sem título';
        const score = doc.score || doc.similaridade || 0;
        console.log(`📄 #${i+1}: "${titulo.substring(0, 30)}..." (${score.toFixed(3)})`);
      });
    } else {
      console.log('⚠️ Nenhum documento relevante encontrado');
    }
    
    // Preparar para gerar resposta
    console.log(`🤔 Gerando resposta para: "${mensagem}"`);
    console.log(`📝 Com histórico: ${historicoConversa.length} mensagens anteriores`);
    
    // Gerar resposta passando o histórico completo
    let respostaObj;
    let respostaTexto;
    try {
      respostaObj = await responseGenerator.gerar(mensagem, documentosRelevantes, historicoConversa, userSettings);
      
      // Extrair a resposta em texto do objeto retornado
      if (respostaObj && typeof respostaObj === 'object' && 'response' in respostaObj) {
        respostaTexto = respostaObj.response;
        console.log(`✅ Resposta gerada: ${respostaTexto.length} caracteres`);
      } else {
        console.log('⚠️ Formato de resposta inesperado:', respostaObj);
        respostaTexto = "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.";
      }
    } catch (error) {
      console.error('❌ Erro ao gerar resposta:', error);
      respostaTexto = "Desculpe, ocorreu um erro ao gerar a resposta. Por favor, tente reformular sua pergunta.";
    }
    
    // Verificar se a resposta é válida
    if (!respostaTexto || typeof respostaTexto !== 'string') {
      console.error('⚠️ Resposta inválida, usando resposta padrão');
      respostaTexto = "Desculpe, não consegui gerar uma resposta adequada para sua pergunta. Por favor, tente reformular ou faça outra pergunta.";
    }
    
    // Enviar resposta
    console.log(`📤 Enviando resposta final (${respostaTexto.length} caracteres)`);
    const enviado = await enviarMensagem(twilioClient, telefone, respostaTexto);
    
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
    
    // Salvar no histórico - garantir que salva apenas o texto da resposta
    const documentosUsados = respostaObj && respostaObj.documents ? respostaObj.documents.map(doc => doc.id || '') : [];
    await firebase.salvarHistoricoConversa(telefone, mensagem, respostaTexto, documentosUsados);
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
 * @returns {Promise<Object>} - Objeto com resposta gerada e metadados
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
