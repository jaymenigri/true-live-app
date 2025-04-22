// utils/responseGenerator.js
const { OpenAI } = require('openai');
const { buscar } = require('./semanticSearch');
const { classificar } = require('./domainClassifier');
const { buscarRespostaFallback } = require('./fallback');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function gerar(query, conversationHistory = [], showSources = true) {
  try {
    console.log(`🤔 Gerando resposta para: "${query}"`);

    let conversationContext = "";
    if (conversationHistory.length > 0) {
      conversationContext = "Histórico recente da conversa:\n\n";
      conversationHistory.forEach(msg => {
        const role = msg.isUser ? "Usuário" : "Assistente";
        conversationContext += `${role}: ${msg.content}\n`;
      });
      conversationContext += "\n";
    }

    const isInDomain = await classificar(query);

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

    const relevantDocs = await buscar(query, 4);

    if (relevantDocs.length === 0) {
      console.log('📚 Nenhum documento relevante. Usando fallback.');
      const resposta = await buscarRespostaFallback(query, conversationContext);
      return {
        response: resposta,
        documents: [],
        usedFallback: true,
        source: "Conhecimento geral (sem documentos específicos)"
      };
    }

    let context = "Informações de fontes confiáveis:\n\n";
    const usedSources = [];

    relevantDocs.forEach((doc, index) => {
      context += `--- Documento ${index + 1} (Fonte: ${doc.source}) ---\n`;
      context += doc.content.slice(0, 1500) + "\n\n";
      if (!usedSources.includes(doc.source)) usedSources.push(doc.source);
    });

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

    let finalResponse = response.choices[0].message.content.trim();

    if (showSources && usedSources.length > 0) {
      finalResponse += "\n\n📚 Fontes consultadas:";
      usedSources.forEach(source => {
        finalResponse += `\n- ${source}`;
      });
    }

    return {
      response: finalResponse,
      documents: relevantDocs.map(doc => ({ id: doc.id, source: doc.source })),
      usedFallback: false,
      source: usedSources.join(', ')
    };
  } catch (error) {
    console.error('❌ Erro ao gerar resposta:', error.message);
    return {
      response: "Desculpe, encontrei um erro ao processar sua pergunta.",
      documents: [],
      usedFallback: true,
      source: "Erro no processamento"
    };
  }
}

module.exports = { gerar };
