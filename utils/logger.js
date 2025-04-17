const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "../logs/conversas.jsonl");

if (!fs.existsSync(path.dirname(LOG_FILE))) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function registrarLog(pergunta, resposta, origem = "whatsapp") {
  const entrada = {
    timestamp: new Date().toISOString(),
    origem,
    pergunta,
    resposta,
  };

  fs.appendFileSync(LOG_FILE, JSON.stringify(entrada) + "\n");
  console.log("📝 Log registrado.");
}

module.exports = { registrarLog };
