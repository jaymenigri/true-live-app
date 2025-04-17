const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Função para enviar mensagem ao OpenAI com contexto opcional
async function askOpenAI(userMessage, contextoOpcional = null) {
  const systemPrompt = `Você é um especialista em geopolítica do Oriente Médio. 
Responda com base nos valores judaico-cristãos, defendendo Israel com fatos e lógica. 
Use fontes confiáveis como MFA.gov.il, JPost.com, INSS e JNS.org. 
Seja claro, objetivo e evite relativizações.`;

  const mensagens = [
    { role: "system", content: systemPrompt },
  ];

  // Se houver contexto fornecido (ex: trecho do fontes.py), insere antes da pergunta
  if (contextoOpcional) {
    mensagens.push({ role: "system", content: `Contexto adicional: ${contextoOpcional}` });
  }

  mensagens.push({ role: "user", content: userMessage });

  try {
    const resposta = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: mensagens,
      temperature: 0.5,
      max_tokens: 800,
    });

    return resposta.choices[0].message.content.trim();
  } catch (error) {
    console.error("❌ Erro ao consultar OpenAI:", error.response?.data || error.message);
    return "Desculpe, houve um erro ao gerar a resposta.";
  }
}

module.exports = { askOpenAI };
