const { generateResponse } = require('../utils/responseGenerator');
require('dotenv').config();

async function test() {
  const queries = [
    "O que é o Hamas?",
    "Quem foi Golda Meir?",
    "Quando foi fundado o Estado de Israel?"
  ];

  for (const query of queries) {
    console.log(`\n\n===== TESTANDO: "${query}" =====`);
    const result = await generateResponse(query);
    console.log("RESPOSTA:");
    console.log(result.response);
    console.log(`Usou fallback: ${result.usedFallback}`);
    console.log(`Documentos usados: ${result.documents.length}`);
  }
}

test();
