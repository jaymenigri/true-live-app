const { OpenAI } = require('openai');
const { searchDocuments } = require('./semanticSearch');
const { classifyQuery } = require('./domainClassifier');
const { buscarRespostaFallback } = require('./fallback');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateResponse(query, conversationHistory = []) {
  try {
    console.log(`🤔 Gerando resposta para: "${query}"`);
    
    // Passo 1: Verificar se a pergunta está no domínio
    const isInDomain = await classifyQuery(query);
    
    if (!isInDomain) {
      console.log('🌐 Pergunta fora do domínio Israel/judaísmo. Usando fallback geral.');
      return {
        response: await buscarRespostaFallback(query),
        documents: [],
        usedFallback: true
      };
    }
    
    // Passo 2: Buscar documentos relevantes
    const relevantDocs = await searchDocuments(query, 3);
    
    // Se não encontrou documentos relevantes
    if (relevantDocs.length === 0) {
      console.log('📚 Nenhum documento relevante encontrado. Usando fallback.');
      return {
        response: await buscarRespostaFallback(query),
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
    
    // Adicionar contexto da conversa, se disponível
    let conversationContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = "Histórico da conversa:\n";
      conversationHistory.forEach(msg => {
        const role = msg.isUser ? "Usuário" : "Assistente";
        conversationContext += `${role}: ${msg.content}\n`;
      });
      conversationContext += "\n";
    }
    
    // Passo 4: Gerar resposta baseada nos documentos
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
    
    console.log('✅ Resposta gerada com sucesso!');
    
    return {
      response: response.choices[0].message.content.trim(),
      documents: relevantDocs.map(doc => doc.id),
      usedFallback: false
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

module.exports = { generateResponse };
