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
 */
// Alteração necessária na função salvarHistoricoConversa para garantir que apenas texto seja salvo

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
    
    // CORREÇÃO: Garantir que a resposta seja uma string antes de salvar
    let respostaText = resposta;
    if (typeof resposta === 'object') {
      respostaText = resposta.response || resposta.text || '';
    }
    
    // Adicionar nova mensagem
    await conversationRef.update({
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      messages: admin.firestore.FieldValue.arrayUnion({
        pergunta: pergunta,
        resposta: respostaText, // Salvar apenas o texto
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

    return messages.slice(-maxMessages);
  } catch (error) {
    console.error('❌ Erro ao obter histórico recente:', error);
    return [];
  }
}

/**
 * Obtém as configurações do usuário
 */
async function getUserSettings(telefone) {
  try {
    const userId = telefone.replace(/\D/g, '');
    const doc = await db.collection('userSettings').doc(userId).get();

    if (doc.exists) {
      return doc.data();
    } else {
      const defaultSettings = {
        showSources: false,
        language: 'pt',
        responseLength: 'medium',
        receiveNews: true
      };

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

/**
 * Retorna todos os documentos com embedding do Firestore
 */
async function getDocuments() {
  try {
    const snapshot = await db.collection('documents').get();
    const documents = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.embedding && Array.isArray(data.embedding)) {
        documents.push({
          id: doc.id,
          content: data.content || '',
          embedding: data.embedding,
          source: data.source || 'Desconhecida',
          title: data.title || ''
        });
      }
    });

    return documents;
  } catch (error) {
    console.error('❌ Erro ao buscar documentos no Firestore:', error);
    return [];
  }
}

module.exports = {
  admin,
  db,
  salvarHistoricoConversa,
  obterHistoricoRecente,
  getUserSettings,
  updateUserSettings,
  getDocuments
};
