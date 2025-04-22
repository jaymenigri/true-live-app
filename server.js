const express = require('express');
const bodyParser = require('body-parser');
const chatController = require('./controllers/chatController');
const { handleMessage } = require('./controllers/chatController');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// Se a função for "processarMensagem" em vez de "handleMessage":
app.post('/webhook', (req, res) => {
  try {
    chatController.processarMensagem(req, res);
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
