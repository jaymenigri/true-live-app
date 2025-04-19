async function handleMessage(req, res) {
  const twiml = new MessagingResponse();
  
  try {
    console.log('📨 Webhook acionado!', new Date().toISOString());
    const texto = req.body.Body;
    const telefone = req.body.From;
    console.log('📝 Mensagem recebida:', texto);
    console.log('📱 De:', telefone);

    // Resposta imediata com a nova mensagem
    twiml.message('Elaborando uma boa resposta... 🧐');
    res.type('text/xml').send(twiml.toString());
    
    // Processar a resposta após enviar a confirmação inicial
    setTimeout(async () => {
      await processarResposta(texto, telefone);
    }, 100);
    
    return;
  } catch (erro) {
    console.error('❌ Erro ao processar webhook:', erro);
    twiml.message('⚠️ Erro interno no servidor.');
    res.type('text/xml').send(twiml.toString());
  }
}
