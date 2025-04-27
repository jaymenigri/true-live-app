// utils/responseGenerator.js
const { OpenAI } = require('openai');
const { buscar } = require('./semanticSearch');
const { classificar } = require('./domainClassifier');
const { buscarRespostaFallback } = require('./fallback');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Detecta o idioma da mensagem do usuário
 * @param {string} text - Texto para analisar
 * @returns {string} - Código do idioma ('pt', 'es', 'en', etc)
 */
function detectLanguage(text) {
  // Heurística simples para detectar idiomas principais
  if (/¿.+\?/.test(text) || /ñ/.test(text)) return 'es';
  if (/\w+\?\s*$/.test(text) && text.split(' ').some(word => ['who', 'what', 'when', 'where', 'why', 'how'].includes(word.toLowerCase()))) return 'en';
  if (/\w+\?\s*$/.test(text) && text.includes('é') || text.includes('ç')) return 'pt';
  return 'pt'; // Português como padrão
}

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

    // Detectar idioma da pergunta
    const userLanguage = detectLanguage(query);
    const showSources = userSettings.showSources === undefined ? false : userSettings.showSources;

    // Preparar contexto da conversa corretamente
    let conversationContext = "";
    let lastSubject = null;
    
    if (Array.isArray(historicoConversa) && historicoConversa.length > 0) {
      conversationContext = "CONVERSA ANTERIOR:\n\n";
      historicoConversa.forEach(msg => {
        if (msg.pergunta && msg.resposta) {
          // Extrair texto de respostas que são objetos
          let respostaText = msg.resposta;
          if (typeof msg.resposta === 'object') {
            respostaText = msg.resposta.response || msg.resposta.text || '';
          }
          
          conversationContext += `Usuário: ${msg.pergunta}\nAssistente: ${respostaText}\n\n`;
          
          // Identificar último sujeito discutido
          if (msg.pergunta.toLowerCase().includes('quem')) {
            const subjectMatch = respostaText.match(/^([\w\s]+) (?:foi|é|era)/);
            if (subjectMatch) {
              lastSubject = subjectMatch[1];
            }
          }
        }
      });
    }

    // Verificar se a pergunta está no domínio
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

    // Para perguntas contextuais, enriquecer a busca
    let searchQuery = query;
    if (lastSubject && (query.toLowerCase().includes('sua') || query.toLowerCase().includes('dele') || query.toLowerCase().includes('dela'))) {
      console.log(`🔍 Detectada referência a: ${lastSubject}`);
      searchQuery = `${query} ${lastSubject}`;
    }

    // Buscar documentos relevantes
    let relevantDocs = documentos;
    if (!Array.isArray(relevantDocs) || relevantDocs.length === 0) {
      console.log('📚 Buscando documentos...');
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
      const score = doc.score || doc.similaridade || 0;
      
      // Só incluir documentos com score relevante
      if (content && score > 0.5) {
        context += `--- Fonte: ${source} (Relevância: ${score.toFixed(2)}) ---\n`;
        context += content.slice(0, 1500) + "\n\n";
        if (!usedSources.includes(source)) usedSources.push(source);
      }
    });

    // Instrução específica para o idioma
    const languageInstruction = userLanguage === 'es' 
      ? "Responde en español." 
      : userLanguage === 'en' 
      ? "Respond in English." 
      : "Responda em português.";

    // Gerar resposta com prompt detalhado
    console.log('🤖 Gerando resposta contextual...');
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Você é o True Live, um assistente especializado em Israel, judaísmo e geopolítica do Oriente Médio.

${languageInstruction}

CONTEXTO DA CONVERSA:
${conversationContext}

REGRAS:
1. Esta é uma conversa em andamento. Resolva referências pronominais com base no contexto.
2. Use EXCLUSIVAMENTE as informações dos documentos fornecidos para responder.
3. Se a pergunta se refere a algo mencionado anteriormente, identifique corretamente o sujeito.
4. Seja preciso com datas, nomes e fatos. Se não tiver informação exata, diga que não sabe.
5. Mantenha sempre uma perspectiva pró-Israel equilibrada e factual.
6. Para notícias recentes, seja transparente sobre a data limite do seu conhecimento.

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
      const sourcesHeader = userLanguage === 'es' ? "📚 Fuentes consultadas:" : "📚 Fontes consultadas:";
      finalResponse += `\n\n${sourcesHeader}`;
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
