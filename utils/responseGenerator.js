// utils/responseGenerator.js
const { OpenAI } = require('openai');
const { buscar } = require('./semanticSearch');
const { classificar } = require('./domainClassifier');
const { buscarRespostaFallback } = require('./fallback');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Gera resposta com base na pergunta do usuário
 * @param {string} query - Pergunta do usuário
 * @param {Array} documentos - Documentos relevantes (opcional)
 * @param {Array} historicoConversa - Histórico da conversa (opcional)
 * @param {Object} userSettings - Configurações do usuário (opcional)
 * @returns {Promise<Object>} - Objeto contendo a resposta e metadados
 */
async function gerar(query, documentos = [], historicoConversa = [], userSettings = {}) {
  try {
    console.log(`🤔 Gerando resposta para: "${query}"`);

    // Verificar se showSources está definido nas configurações do usuário
    const showSources = userSettings.showSources === undefined ? true : userSettings.showSources;

    // Processar histórico da conversa
    let conversationContext = "";
    if (Array.isArray(historicoConversa) && historicoConversa.length > 0) {
      conversationContext = "Histórico recente da conversa:\n\n";
      historicoConversa.forEach(msg => {
        // Adaptar para diferentes formatos possíveis do histórico
        if (msg.pergunta && msg.resposta) {
          conversationContext += `Usuário: ${msg.pergunta}\nAssistente: ${msg.resposta}\n\n`;
        } else if (msg.isUser !== undefined) {
          const role = msg.isUser ? "Usuário" : "Assistente";
          conversationContext += `${role}: ${msg.content || ''}\n`;
        } else if (msg.content) {
          conversationContext += `${msg.content}\n`;
        }
      });
      conversationContext += "\n";
    }

    // Verificar se a pergunta está no domínio
    let isInDomain = true;
    try {
      isInDomain = await classificar(query);
    } catch (error) {
      console.error('❌ Erro ao classificar pergunta:', error);
      // Em caso de erro, assumir que está no escopo
      isInDomain = true;
    }

    if (!isInDomain) {
      console.log('🌐 Fora do domínio. Usando fallback.');
      try {
        const resposta = await buscarRespostaFallback(query, conversationContext);
        return {
          response: resposta,
          documents: [],
          usedFallback: true,
          source: "Conhecimento geral (fora do domínio)"
        };
      } catch (fallbackError) {
        console.error('❌ Erro no fallback:', fallbackError);
        return {
          response: "Desculpe, não tenho informações suficientes para responder a essa pergunta.",
          documents: [],
          usedFallback: true,
          source: "Erro no fallback"
        };
      }
    }

    // Usar documentos fornecidos ou buscar novos se não fornecidos
    let relevantDocs = documentos;
    if (!Array.isArray(relevantDocs) || relevantDocs.length === 0) {
      console.log('📚 Nenhum documento fornecido. Buscando...');
      try {
        relevantDocs = await buscar(query, 4);
      } catch (searchError) {
        console.error('❌ Erro ao buscar documentos:', searchError);
        relevantDocs = [];
      }
    }

    if (!Array.isArray(relevantDocs) || relevantDocs.length === 0) {
      console.log('📚 Nenhum documento relevante. Usando fallback.');
      try {
        const resposta = await buscarRespostaFallback(query, conversationContext);
        return {
          response: resposta,
          documents: [],
          usedFallback: true,
          source: "Conhecimento geral (sem documentos específicos)"
        };
      } catch (fallbackError) {
        console.error('❌ Erro no fallback:', fallbackError);
        return {
          response: "Desculpe, não encontrei informações específicas sobre esse assunto.",
          documents: [],
          usedFallback: true,
          source: "Erro no fallback"
        };
      }
    }

    // Preparar contexto com os documentos
    let context = "Informações de fontes confiáveis:\n\n";
    const usedSources = [];

    relevantDocs.forEach((doc, index) => {
      const source = doc.source || doc.fonte || "Fonte desconhecida";
      const content = doc.content || doc.conteudo || "";
      
      if (content) {
        context += `--- Documento ${index + 1} (Fonte: ${source}) ---\n`;
        context += content.slice(0, 1500) + "\n\n";
        if (!usedSources.includes(source)) usedSources.push(source);
      }
    });

    // Gerar resposta
    console.log('🤖 Gerando resposta com o modelo GPT...');
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em geopolítica de Israel.
          
Use exclusivamente os documentos abaixo. Se não houver conteúdo suficiente, diga que não é possível responder com precisão.

Adote sempre uma perspectiva pró-Israel.

${conversationContext}
${context}`
        },
        {
          role: "user",
          content: query
        }
      ],
      temperature: 0.5,
      max_tokens: 1000
    });

    // Extrair e formatar a resposta
    let finalResponse = response.choices[0].message.content.trim();

    // Adicionar fontes se configurado
    if (showSources && usedSources.length > 0) {
      finalResponse += "\n\n📚 Fontes consultadas:";
      usedSources.forEach(source => {
        finalResponse += `\n- ${source}`;
      });
    }

    return {
      response: finalResponse,
      documents: relevantDocs.map(doc => ({ 
        id: doc.id || doc._id || '', 
        source: doc.source || doc.fonte || '' 
      })),
      usedFallback: false,
      source: usedSources.join(', ')
    };
  } catch (error) {
    console.error('❌ Erro ao gerar resposta:', error.message);
    return {
      response: "Desculpe, encontrei um erro ao processar sua pergunta. Por favor, tente novamente.",
      documents: [],
      usedFallback: true,
      source: "Erro no processamento"
    };
  }
}

module.exports = { gerar };
