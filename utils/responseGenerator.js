async function generateResponse(query, conversationHistory = [], showSources = true) {
  try {
    console.log(`🤔 Gerando resposta para: "${query}"`);
    
    // Formatar histórico da conversa para contexto
    let conversationContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = "Histórico recente da conversa (use para entender o contexto completo):\n\n";
      conversationHistory.forEach(msg => {
        const role = msg.isUser ? "Usuário" : "Assistente";
        conversationContext += `${role}: ${msg.content}\n`;
      });
      conversationContext += "\n";
      console.log(`📜 Incluindo histórico de ${conversationHistory.length} mensagens no contexto`);
    }
    
    // ... código existente para enriquecer consulta ...
    
    // Passo 1: Verificar se a pergunta está no domínio
    const isInDomain = await classifyQuery(enrichedQuery || query);
    
    if (!isInDomain) {
      console.log('🌐 Pergunta fora do domínio Israel/judaísmo. Usando fallback geral.');
      return {
        response: await buscarRespostaFallback(enrichedQuery || query, conversationContext),
        documents: [],
        usedFallback: true,
        source: "Conhecimento geral (fora do domínio especializado)"
      };
    }
    
    // Passo 2: Buscar documentos relevantes
    const relevantDocs = await searchDocuments(enrichedQuery || query, 4);
    
    // Se não encontrou documentos relevantes
    if (relevantDocs.length === 0) {
      console.log('📚 Nenhum documento relevante encontrado. Usando fallback.');
      return {
        response: await buscarRespostaFallback(enrichedQuery || query, conversationContext),
        documents: [],
        usedFallback: true,
        source: "Conhecimento geral (sem documentos específicos)"
      };
    }
    
    // Passo 3: Preparar contexto para a OpenAI
    let context = "Informações de fontes confiáveis:\n\n";
    
    // Registrar fontes usadas
    const usedSources = [];
    
    relevantDocs.forEach((doc, index) => {
      context += `--- Documento ${index + 1} (Fonte: ${doc.source}) ---\n`;
      context += doc.content.slice(0, 1500) + "\n\n"; // Limitar tamanho
      
      // Adicionar à lista de fontes se ainda não estiver lá
      if (!usedSources.includes(doc.source)) {
        usedSources.push(doc.source);
      }
    });
    
    // Passo 4: Gerar resposta baseada nos documentos e contexto da conversa
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em geopolítica do Oriente Médio, Israel e judaísmo.
          
          Responda à pergunta do usuário usando EXCLUSIVAMENTE as informações fornecidas nos documentos abaixo.
          Se os documentos não contiverem informações suficientes para responder com precisão, diga "Não tenho informações suficientes para responder a essa pergunta com precisão."
          
          Mantenha uma perspectiva pró-Israel e judaica em sua resposta.
          
          Seja direto, claro e objetivo. Não mencione os documentos na sua resposta.
          
          MUITO IMPORTANTE: Use o histórico da conversa para entender o contexto completo da pergunta atual.
          Se o usuário fizer perguntas curtas como "Por quê?", "Quando?", "O que aconteceu depois?", ou usar pronomes como "ele", "ela", "eles", "isso", 
          você DEVE entender a que esses pronomes se referem com base no histórico da conversa.
          
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
    
    // Obter resposta
    let finalResponse = response.choices[0].message.content.trim();
    
    // Adicionar fontes se solicitado (showSources)
    if (showSources && usedSources.length > 0) {
      finalResponse += "\n\n📚 Fontes consultadas:";
      usedSources.forEach(source => {
        finalResponse += `\n- ${source}`;
      });
    }
    
    console.log('✅ Resposta gerada com sucesso!');
    console.log(`📚 Fontes utilizadas: ${usedSources.join(', ')}`);
    
    return {
      response: finalResponse,
      documents: relevantDocs.map(doc => ({ id: doc.id, source: doc.source })),
      usedFallback: false,
      enrichedQuery: enrichedQuery !== query ? enrichedQuery : null,
      source: usedSources.join(', ')
    };
  } catch (error) {
    console.error('❌ Erro ao gerar resposta:', error.message);
    return {
      response: "Desculpe, encontrei um erro ao processar sua pergunta. Por favor, tente novamente mais tarde.",
      documents: [],
      usedFallback: true,
      source: "Erro no processamento"
    };
  }
}
