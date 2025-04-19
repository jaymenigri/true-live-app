// Localize a função que processa comandos de configuração (processarComandoConfig)
// e adicione o seguinte código dentro dela:

async function processarComandoConfig(telefone, params, twilioClient) {
  // Comando para configurar recebimento de notícias
  if (params.includes('noticias') || params.includes('news')) {
    const receiveNews = params.includes('on') || params.includes('sim') || params.includes('yes');
    await firebase.updateUserSettings(telefone, { receiveNews });
    
    await enviarMensagem(
      twilioClient, 
      telefone, 
      `✅ Configuração atualizada: recebimento de notícias ${receiveNews ? 'ativado' : 'desativado'}.`
    );
    return;
  }

  // Localize a mensagem de ajuda de configuração (normalmente enviada quando o usuário digita /config sem parâmetros)
  // e atualize para incluir as opções de notícias:
  await enviarMensagem(
    twilioClient, 
    telefone, 
    `🔧 Comandos de configuração disponíveis:
    
/config fontes on - Ativar exibição de fontes
/config fontes off - Desativar exibição de fontes
/config noticias on - Ativar recebimento de notícias
/config noticias off - Desativar recebimento de notícias`
  );
}
