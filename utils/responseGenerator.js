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

    // Preparar contexto da conversa - deixar a IA entender naturalmente
    let conversationContext = "";
    if (Array.isArray(historicoConversa) && historicoConversa.length > 0) {
      conversationContext = "CONVERSA ANTERIOR:\n\n";
      historicoConversa.forEach(msg => {
        if (msg.pergunta && msg.resposta) {
          conversationContext += `Usuário: ${msg.pergunta}\nAssistente: ${msg.resposta}\n\n`;
        }
      });
    }

    // Verificar se a pergunta está no domínio, considerando o contexto
    let isInDomain = true;
    if (conversationContext) {
      // Se há histórico, incluí-lo na classificação
      try {
        const contextAwareQuestion = `${conversationContext}\nUsuário: ${query}`;
        isInDomain = await classificar(contextAwareQuestion);
      } catch (error) {
        console.error('❌ Erro ao classificar pergunta com contexto:', error);
        isInDomain = await classificar(query);
      }
    } else {
      isInDomain = await classificar(query);
    }

    if (!isInDomain) {
      console.log('🌐 Fora do domínio. Usando fallback.');
      const resposta = await buscarRespostaFallback(query, conversationContext);
      return {
        response: resposta,
        documents: [],
        usedFallback: true,
        source: "Conhecimento geral (fora do domínio)"
      };
    }

    // Buscar documentos relevantes - também considerando o contexto se disponível
    let relevantDocs = documentos;
    if (!Array.isArray(relevantDocs) || relevantDocs.length === 0) {
      console.log('📚 Buscando documentos...');
      const searchQuery = conversationContext ? `${conversationContext}\nUsuário: ${query}` : query;
      relevantDocs = await buscar(searchQuery, 4);
    }

    if (!Array.isArray(relevantDocs) || relevantDocs.length === 0) {
      console.log('📚 Nenhum documento relevante. Usando fallback.');
      const resposta = await buscarRespostaFallback(query, conversationContext);
      return {
        response: resposta,
        documents: [],
        usedFallback: true,
        source: "Conhecimento geral (sem documentos específicos)"
      };
    }

    // Preparar contexto com os documentos
    let context = "INFORMAÇÕES DAS FONTES CONFIÁVEIS:\n\n";
    const usedSources = [];

    relevantDocs.forEach((doc, index) => {
      const source = doc.source || doc.fonte || "Fonte desconhecida";
      const content = doc.content || doc.conteudo || "";
      
      if (content) {
        context += `--- Fonte: ${source} ---\n`;
        context += content.slice(0, 1500) + "\n\n";
        if (!usedSources.includes(source)) usedSources.push(source);
      }
    });

    // Gerar resposta - deixar a IA entender o contexto naturalmente
    console.log('🤖 Gerando resposta...');
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Você é o True Live, um assistente especializado em Israel, judaísmo e geopolítica do Oriente Médio.

${conversationContext ? "Há uma conversa em andamento. Use o contexto para entender referências e manter a continuidade:\n" + conversationContext : ""}

REGRAS IMPORTANTES:
1. Use EXCLUSIVAMENTE as informações dos documentos fornecidos abaixo para responder.
2. Se não houver informações suficientes nos documentos, diga claramente que não pode responder com precisão.
3. Mantenha sempre uma perspectiva pró-Israel.
4. Seja preciso e factual, citando as fontes quando relevante.

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

    // Formatar a resposta
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
