// scripts/testKnowledgeBase.js
const { findMostSimilarQuestion } = require('../utils/embeddingUtils');
const readline = require('readline');
require('dotenv').config();

// Criar interface de linha de comando
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🤖 True Live - Teste da Base de Conhecimento');
console.log('Digite "sair" para encerrar o programa\n');

function perguntarAoUsuario() {
  rl.question('📝 Digite sua pergunta: ', async (pergunta) => {
    if (pergunta.toLowerCase() === 'sair') {
      console.log('\n👋 Encerrando o programa...');
      rl.close();
      return;
    }
    
    try {
      console.log('\n🔍 Buscando resposta...');
      const resultado = await findMostSimilarQuestion(pergunta);
      
      if (resultado && resultado.similarity) {
        console.log(`\n📊 Similaridade: ${resultado.similarity.toFixed(4)}`);
        console.log(`❓ Pergunta mais próxima: ${resultado.pergunta}`);
        console.log(`\n📄 Resposta: ${resultado.resposta}`);
        console.log(`\n📚 Fonte: ${resultado.fonte || 'Não especificada'}`);
      } else {
        console.log('\n❌ Nenhuma correspondência encontrada na base de conhecimento');
      }
    } catch (error) {
      console.error('\n❌ Erro ao buscar resposta:', error.message);
    }
    
    console.log('\n-----------------------------------');
    perguntarAoUsuario(); // Continuar perguntando
  });
}

// Iniciar o loop de perguntas
perguntarAoUsuario();
