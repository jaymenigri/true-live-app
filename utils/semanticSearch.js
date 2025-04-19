// Em algum lugar próximo ao início do arquivo
const SIMILARITY_THRESHOLD = 0.3; // Reduzido de 0.5 para 0.3

// Na função searchDocuments, após calcular as similaridades e obter topResults
// Adicionar verificação de log detalhado sobre qual fonte foi usada

if (topResults.length > 0 && topResults[0].similarity >= SIMILARITY_THRESHOLD) {
  console.log(`✅ Encontrados ${topResults.length} documentos relevantes`);
  
  // Log detalhado dos documentos encontrados
  topResults.forEach((doc, index) => {
    console.log(`📄 #${index+1}: "${doc.title.substring(0, 30)}..." (${doc.similarity.toFixed(3)})`);
  });
  
  return topResults;
} else {
  // Se o melhor resultado não atingir o limiar
  console.warn(`⚠️ Melhor similaridade (${topResults.length > 0 ? topResults[0].similarity.toFixed(3) : 'N/A'}) abaixo do limiar (${SIMILARITY_THRESHOLD}). Usando fallback.`);
  return [];
}
