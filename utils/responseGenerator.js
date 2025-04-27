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
    const showSources = userSettings.showSources === undefined ? false : userSettings.showSources;

    // Preparar contexto da conversa
    let conversationContext = "";
    if (Array.isArray(historicoConversa) && historicoConversa.length > 0) {
      conversationContext = "CONVERSA ANTERIOR:\n\n";
      historicoConversa.forEach(msg => {
        if (msg.pergunta && msg.resposta) {
          // Garantir que resposta seja uma string
          const respostaText = typeof msg.resposta === 'object' 
            ? (msg.resposta.response || msg.resposta.text || JSON.stringify(msg.resposta))
            : msg.resposta;
          conversationContext += `Usuário: ${msg.pergunta}\nAssistente: ${respostaText}\n\n`;
        }
      });
    }

    // Verificar se a pergunta está no domínio, considerando o contexto
    let isInDomain = true;
    if (conversationContext) {
      const contextAwareQuestion = `${conversationContext}\nUsuário: ${query}`;
      isInDomain = await classificar(contextAwareQuestion);
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

    // Para perguntas contextuais, tentar enriquecer a busca
    let searchQuery = query;
    if (conversationContext && query.toLowerCase().includes('sua') || query.toLowerCase().includes('dele') || query.toLowerCase().includes('dela')) {
      console.log('🔍 Detectada referência contextual. Buscando com contexto...');
      searchQuery = `${conversationContext}\nUsuário: ${query}`;
    }

    // Buscar documentos relevantes
    let relevantDocs = documentos;
    if (!Array.isArray(relevantDocs) || relevantDocs.length === 0) {
      console.log('📚 Buscando documentos...');
      relevantDocs = await buscar(searchQuery, 4);
    }

    // Se não encontrar documentos relevantes com a busca contextual, tentar busca simples
    if ((!relevantDocs || relevantDocs.length === 0) && searchQuery !== query) {
      console.log('🔄 Tentando busca simples sem contexto...');
      relevantDocs = await buscar(query, 4);
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

    // Gerar resposta com prompt mais detalhado para contexto
    console.log('🤖 Gerando resposta contextual...');
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Você é o True Live, um assistente especializado em Israel, judaísmo e geopolítica do Oriente Médio.

CONTEXTO DA CONVERSA:
${conversationContext}

REGRAS:
1. Esta é uma conversa em andamento. Resolva referências pronominais (sua, dele, dela) com base no contexto.
2. Use EXCLUSIVAMENTE as informações dos documentos fornecidos para responder.
3. Se a pergunta se refere a algo mencionado anteriormente, identifique corretamente o sujeito.
4. Seja preciso com datas e fatos. Se não tiver informação exata, diga que não sabe.
5. Mantenha sempre uma perspectiva pró-Israel.

DOCUMENTOS DISPONÍVEIS:
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
