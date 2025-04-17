function dividirResposta(texto, limite = 1500) {
  if (texto.length <= limite) return [texto];

  const partes = [];
  let atual = "";

  const parágrafos = texto.split("\n");

  for (const p of parágrafos) {
    if ((atual + "\n" + p).length > limite) {
      partes.push(atual.trim());
      atual = p;
    } else {
      atual += "\n" + p;
    }
  }

  if (atual) partes.push(atual.trim());

  return partes;
}

module.exports = { dividirResposta };
