// utils/domainClassifier.js
const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Classifica se uma pergunta está dentro do domínio de Israel/judaísmo/geopolítica
 * Considera o contexto da conversa quando fornecido
 * @param {string} query - Pergunta do usuário ou pergunta com contexto
 * @returns {Promise<boolean>} - True se dentro do domínio
 */
async function classificar(query) {
  try {
    console.log(`🔍 Classificando pergunta: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
    
    // Se query contém histórico estruturado (formato "CONVERSA ANTERIOR:"), use prompt especial
    const isContextualized = query.includes("CONVERSA ANTERIOR:");
    
    const systemPrompt = isContextualized
      ? `Você é um classificador que determina se perguntas estão relacionadas a Israel, judaísmo, cultura judaica, geopolítica do Oriente Médio, líderes israelenses ou história judaica.

IMPORTANTE: Você está analisando uma conversa em contexto. Se a pergunta atual se refere a algo mencionado anteriormente sobre Israel ou judaísmo, classifique como DENTRO do domínio.

Responda apenas com "true" se estiver dentro do domínio ou "false" se não estiver.`
      : `Você é um classificador que determina se perguntas estão relacionadas a Israel, judaísmo, cultura judaica, geopolítica do Oriente Médio, líderes israelenses ou história judaica.

Critérios para classificar como DENTRO do domínio:
- Perguntas sobre Israel, seu povo, história, política, economia ou sociedade
- Perguntas sobre judaísmo, cultura judaica, festas judaicas, tradições
- Perguntas sobre conflitos no Oriente Médio envolvendo Israel
- Perguntas sobre líderes israelenses (políticos, religiosos, militares)
- Perguntas sobre antissemitismo ou questões relacionadas
- Perguntas sobre sionismo ou movimentos relacionados

Responda apenas com "true" se estiver dentro do domínio ou "false" se não estiver.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: query
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    });

    const resultado = response.choices[0].message.content.trim().toLowerCase();
    const estaNoDominio = resultado === "true";
    
    console.log(`📊 Classificação: ${estaNoDominio ? 'Dentro do domínio' : 'Fora do domínio'}`);
    return estaNoDominio;
  } catch (error) {
    console.error('❌ Erro ao classificar pergunta:', error);
    // Em caso de erro, assume que está no domínio para evitar frustração do usuário
    return true;
  }
}

module.exports = { classificar };
