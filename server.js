const express = require('express');
const bodyParser = require('body-parser');
const { handleMessage } = require('./controllers/chatController');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/webhook', async (req, res) => {
  try {
    await handleMessage(req, res);
  } catch (erro) {
    console.error('❌ Erro ao processar webhook:', erro);
    res.status(500).send('<Response><Message>⚠️ Erro interno no servidor.</Message></Response>');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
