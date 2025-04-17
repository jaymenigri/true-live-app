const { findMostSimilarQuestion, dividirResposta } = require('../utils/embeddingUtils');
const { buscarRespostaFallback } = require('../utils/fallback');
const twilio = require('twilio');
const MessagingResponse = twilio.twiml.MessagingResponse;

async function handleMessage(req, res) {
  const twiml = new MessagingResponse();

  try {
    console.log('📨 Webhook acionado!', new Date().toISOString());
    const texto = req.body.Body;
    const telefone = req.body.From;
    console.log('📝 Mensagem recebida:', texto);
    console.log('📱 De:', telefone);

    const similar = await findMostSimilarQuestion(texto);
    if (similar) {
      console.log('🔎 Melhor similaridade:', similar.similarity.toFixed(3));
      const respostas = dividirResposta(similar.pergunta.resposta);
      for (const parte of respostas) {
        twiml.message(parte);
      }
    } else {
      console.warn('⚠️ Nenhuma pergunta similar encontrada. Usando fallback.');
      const respostaFallback = await buscarRespostaFallback(texto);
      const partesFallback = dividirResposta(respostaFallback);
      for (const parte of partesFallback) {
        twiml.message(parte);
      }
    }
  } catch (erro) {
    console.error('❌ Erro ao processar webhook:', erro);
    twiml.message('⚠️ Erro interno no servidor.');
  }

  res.type('text/xml').send(twiml.toString());
}

module.exports = { handleMessage };
