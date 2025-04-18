const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function buscarRespostaFallback(pergunta, contexto = "") {
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

module.exports = { buscarRespostaFallback };
