const { OpenAI } = require('openai');
const { searchDocuments } = require('./semanticSearch');
const { classifyQuery } = require('./domainClassifier');
const { buscarRespostaFallback } = require('./fallback');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateResponse(query, conversationHistory = []) {
  try {
    console.log(`🤔 Gerando resposta para: "${query}"`);
    
    // Formatar histórico da conversa para contexto
    let conversationContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = "Histórico recente da conversa (use para entender o contexto completo):\n\n";
      conversationHistory.forEach(msg => {
        const role = msg.isUser ? "Usuário" : "Assistente";
        conversationContext += `${role}: ${msg.content}\n`;
      });
      conversationContext += "\n";
      console.log(`📜 Incluindo histórico de ${conversationHistory.length} mensagens no contexto`);
    }
    
    // Se a pergunta for muito curta ou ambígua, usar o contexto para enriquecê-la
    let enrichedQuery = query;
    if (query.length < 15 && conversationHistory && conversationHistory.length >= 2) {
      // Enriquecer consulta curta com contexto para melhor busca
      const contextEnrichment = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `Você é um assistente que reformula perguntas curtas ou ambíguas em perguntas mais completas usando o contexto da conversa. 
            NÃO responda à pergunta, apenas reformule-a para ser mais específica e completa.`
          },
          {
            role: "user",
            content: `Histórico da conversa:
            ${conversationContext}
            
            Pergunta original curta ou ambígua: "${query}"
            
            Reformule esta pergunta para ser mais específica, usando o contexto acima. 
            Mantenha sua resposta APENAS com a pergunta reformulada, sem explicações.`
          }
        ],
        temperature: 0.3,
        max_tokens: 100
      });
      
      enrichedQuery = contextEnrichment.choices[0].message.content.trim();
      console.log(`🔄 Pergunta enriquecida com contexto: "${enrichedQuery}"`);
    }
    
    // Passo 1: Verificar se a pergunta está no domínio
    const isInDomain = await classifyQuery(enrichedQuery);
    
    if (!isInDomain) {
      console.log('🌐 Pergunta fora do domínio Israel/judaísmo. Usando fallback geral.');
      return {
        response: await buscarRespostaFallback(enrichedQuery, conversationContext),
        documents: [],
        usedFallback: true
      };
    }
    
    // Passo 2: Buscar documentos relevantes
    const relevantDocs = await searchDocuments(enrichedQuery, 4); // Aumentamos para 4 docs
    
    // Se não encontrou documentos relevantes
    if (relevantDocs.length === 0) {
      console.log('📚 Nenhum documento relevante encontrado. Usando fallback.');
      return {
        response: await buscarRespostaFallback(enrichedQuery, conversationContext),
        documents: [],
        usedFallback: true
      };
    }
    
    // Passo 3: Preparar contexto para a OpenAI
    let context = "Informações de fontes confiáveis:\n\n";
    
    relevantDocs.forEach((doc, index) => {
      context += `--- Documento ${index + 1} (Fonte: ${doc.source}) ---\n`;
      context += doc.content.slice(0, 1500) + "\n\n"; // Limitar tamanho
    });
    
    // Passo 4: Gerar resposta baseada nos documentos e contexto da conversa
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em geopolítica do Oriente Médio, Israel e judaísmo.
          
          Responda à pergunta do usuário usando EXCLUSIVAMENTE as informações fornecidas nos documentos abaixo.
          Se os documentos não contiverem informações suficientes para responder com precisão, diga "Não tenho informações suficientes para responder a essa pergunta com precisão."
          
          Mantenha uma perspectiva pró-Israel e judaica em sua resposta.
          
          Seja direto, claro e objetivo. Não mencione os documentos na sua resposta.
          
          MUITO IMPORTANTE: Use o histórico da conversa para entender o contexto completo da pergunta atual.
          Se o usuário fizer perguntas curtas como "Por quê?", "Quando?", "O que aconteceu depois?", ou usar pronomes como "ele", "ela", "eles", "isso", 
          você DEVE entender a que esses pronomes se referem com base no histórico da conversa.
          
          ${conversationContext}
          
          ${context}`
        },
        {
          role: "user",
          content: query // Mantemos a pergunta original para preservar a naturalidade
        }
      ],
      temperature: 0.5,
      max_tokens: 1000
    });
    
    console.log('✅ Resposta gerada com sucesso!');
    
    return {
      response: response.choices[0].message.content.trim(),
      documents: relevantDocs.map(doc => doc.id),
      usedFallback: false,
      enrichedQuery: enrichedQuery !== query ? enrichedQuery : null
    };
  } catch (error) {
    console.error('❌ Erro ao gerar resposta:', error.message);
    return {
      response: "Desculpe, encontrei um erro ao processar sua pergunta. Por favor, tente novamente mais tarde.",
      documents: [],
      usedFallback: true
    };
  }
}

// Atualização do fallback para incluir contexto da conversa
async function buscarRespostaFallbackComContexto(pergunta, contexto = "") {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Você é um assistente especializado em temas ligados a Israel, judaísmo, geopolítica e antissemitismo. 
          Sempre responda com base em fontes confiáveis e com viés israelense-judaico.
          
          ${contexto ? "Use o seguinte contexto da conversa para entender melhor a pergunta do usuário:\n\n" + contexto : ""}`
        },
        {
          role: "user",
          content: pergunta
        }
      ],
      temperature: 0.5,
      max_tokens: 1000
    });

    const resposta = response.choices[0]?.message?.content || null;
    return resposta;
  } catch (erro) {
    console.error("❌ Erro no fallback:", erro.message);
    return "Desculpe, não consegui encontrar uma resposta para sua pergunta. Tente reformulá-la ou perguntar sobre outro tópico relacionado a Israel.";
  }
}

module.exports = { 
  generateResponse, 
  buscarRespostaFallbackComContexto 
};
