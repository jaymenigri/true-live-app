const admin = require('firebase-admin');
require('dotenv').config();

// Inicializar Firebase Admin
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (error) {
  console.error('Erro ao parsear as credenciais do Firebase:', error);
  serviceAccount = null;
}

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    console.warn('⚠️ Firebase inicializado sem credenciais. Alguns recursos podem não funcionar corretamente.');
    admin.initializeApp();
  }
}

const db = admin.firestore();

/**
 * Armazena a pergunta e resposta no histórico de conversa
 * @param {string} telefone - Número de telefone do usuário
 * @param {string} pergunta - Pergunta do usuário
 * @param {string} resposta - Resposta gerada pelo sistema
 * @param {Array} documentosUsados - Lista de IDs de documentos usados na resposta
 * @returns {Promise<void>}
 */
async function salvarHistoricoConversa(telefone, pergunta, resposta, documentosUsados = []) {
  try {
    const userId = telefone.replace(/\D/g, '');
    const conversationRef = db.collection('conversations').doc(userId);
    
    // Verificar se o documento existe
    const doc = await conversationRef.get();
    
    if (!doc.exists) {
      // Criar documento inicial
      await conversationRef.set({
        phone: telefone,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        messages: []
      });
    }
    
    // Adicionar nova mensagem
    await conversationRef.update({
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      messages: admin.firestore.FieldValue.arrayUnion({
        pergunta: pergunta,
        resposta: resposta,
        timestamp: new Date().toISOString(),
        documentosUsados: documentosUsados
      })
    });
    
    console.log(`✅ Histórico salvo para usuário ${userId}`);
  } catch (error) {
    console.error('❌ Erro ao salvar histórico:', error);
  }
}

/**
 * Obtém o histórico recente de conversa do usuário
 * @param {string} telefone - Número de telefone do usuário
 * @param {number} maxMessages - Número máximo de mensagens para retornar
 * @returns {Promise<Array>} - Array de mensagens recentes
 */
async function obterHistoricoRecente(telefone, maxMessages = 5) {
  try {
    const userId = telefone.replace(/\D/g, '');
    const conversationRef = db.collection('conversations').doc(userId);
    
    const doc = await conversationRef.get();
    
    if (!doc.exists) {
      return [];
    }
    
    const data = doc.data();
    const messages = data.messages || [];
    
    // Retornar as mensagens mais recentes
    return messages.slice(-maxMessages);
  } catch (error) {
    console.error('❌ Erro ao obter histórico recente:', error);
    return [];
  }
}

/**
 * Obtém as configurações do usuário
 * @param {string} telefone - Número de telefone do usuário
 * @returns {Promise<Object>} - Configurações do usuário
 */
async function getUserSettings(telefone) {
  try {
    const userId = telefone.replace(/\D/g, '');
    const doc = await db.collection('userSettings').doc(userId).get();
    
    if (doc.exists) {
      return doc.data();
    } else {
      // Configurações padrão
      const defaultSettings = { 
        showSources: false, 
        language: 'pt',
        responseLength: 'medium',
        receiveNews: true // ativado por padrão
      };
      
      // Criar configurações padrão
      await db.collection('userSettings').doc(userId).set(defaultSettings);
      return defaultSettings;
    }
  } catch (error) {
    console.error('❌ Erro ao buscar configurações do usuário:', error);
    return { 
      showSources: false, 
      language: 'pt', 
      responseLength: 'medium',
      receiveNews: true
    };
  }
}

/**
 * Atualiza as configurações do usuário
 * @param {string} telefone - Número de telefone do usuário
 * @param {Object} settings - Configurações a serem atualizadas
 * @returns {Promise<boolean>} - Sucesso da operação
 */
async function updateUserSettings(telefone, settings) {
  try {
    const userId = telefone.replace(/\D/g, '');
    await db.collection('userSettings').doc(userId).set(settings, { merge: true });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar configurações do usuário:', error);
    return false;
  }
}

module.exports = {
  admin,
  db,
  salvarHistoricoConversa,
  obterHistoricoRecente,
  getUserSettings,
  updateUserSettings
};
