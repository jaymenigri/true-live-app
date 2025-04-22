// utils/domainClassifier.js
const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function classificar(query) {
  try {
    console.log(`🔍 Classificando pergunta: "${query}"`);

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Você é um classificador que determina se uma pergunta está relacionada a Israel, judaísmo, antissemitismo, sionismo, conflito árabe-israelense, geopolítica do Oriente Médio ou história judaica.
          
          Responda apenas com "sim" se a pergunta estiver relacionada a esses temas ou "não" se não estiver. Não inclua explicações.`
        },
        {
          role: "user",
          content: query
        }
      ],
      temperature: 0.1,
      max_tokens: 5
    });

    const classification = response.choices[0].message.content.trim().toLowerCase();
    const isInDomain = classification.includes('sim');

    console.log(`📊 Classificação: ${isInDomain ? 'Dentro do domínio' : 'Fora do domínio'}`);
    return isInDomain;
  } catch (error) {
    console.error('❌ Erro ao classificar pergunta:', error.message);
    return true;
  }
}

module.exports = { classificar };
