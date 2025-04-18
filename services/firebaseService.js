const admin = require('firebase-admin');

// Inicializar Firebase se não estiver inicializado
if (!admin.apps.length) {
  try {
    // Se FIREBASE_CREDENTIALS está como JSON string
    const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase inicializado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error.message);
    // Failback para inicialização sem credenciais (desenvolvimento)
    admin.initializeApp();
  }
}

const db = admin.firestore();
const documentsCollection = db.collection('documents');
const conversationsCollection = db.collection('conversations');

// Funções para documentos
async function saveDocument(document) {
  try {
    await documentsCollection.doc(document.id).set(document);
    return document;
  } catch (error) {
    console.error(`❌ Erro ao salvar documento ${document.id}:`, error.message);
    throw error;
  }
}

async function getDocuments() {
  try {
    const snapshot = await documentsCollection.get();
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('❌ Erro ao recuperar documentos:', error.message);
    return [];
  }
}

async function getDocumentById(id) {
  try {
    const doc = await documentsCollection.doc(id).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error(`❌ Erro ao recuperar documento ${id}:`, error.message);
    return null;
  }
}

// Funções para conversas
async function saveConversation(telefone, message, isUser = true, metadata = {}) {
  try {
    const conversationId = telefone.replace(/\D/g, ''); // Remove não-dígitos
    const messageObj = {
      content: message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      isUser,
      ...metadata
    };
    
    // Adicionar mensagem à conversa
    await conversationsCollection
      .doc(conversationId)
      .collection('messages')
      .add(messageObj);
    
    // Atualizar metadata da conversa
    await conversationsCollection.doc(conversationId).set({
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      telefone,
      messageCount: admin.firestore.FieldValue.increment(1)
    }, { merge: true });
    
    return messageObj;
  } catch (error) {
    console.error(`❌ Erro ao salvar conversa:`, error.message);
    // Retornar mensagem mesmo com erro para não interromper fluxo
    return { content: message, timestamp: new Date(), isUser };
  }
}

async function getConversationHistory(telefone, limit = 10) {
  try {
    const conversationId = telefone.replace(/\D/g, '');
    
    const snapshot = await conversationsCollection
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    const messages = snapshot.docs.map(doc => {
      const data = doc.data();
      // Converter timestamp do Firestore para objeto Date
      const timestamp = data.timestamp && data.timestamp.toDate ? 
                        data.timestamp.toDate() : new Date();
      return {
        ...data,
        timestamp
      };
    });
    
    // Reverse para ordem cronológica
    return messages.reverse();
  } catch (error) {
    console.error(`❌ Erro ao recuperar histórico:`, error.message);
    return [];
  }
}

// Nova função para limpar histórico antigo (manutenção)
async function cleanupOldConversations(daysOld = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const oldConversations = await conversationsCollection
      .where('lastUpdated', '<', cutoffDate)
      .get();
    
    console.log(`🧹 Encontradas ${oldConversations.size} conversas antigas para limpeza`);
    
    const batch = db.batch();
    oldConversations.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('✅ Limpeza de conversas antigas concluída');
    
    return oldConversations.size;
  } catch (error) {
    console.error('❌ Erro ao limpar conversas antigas:', error.message);
    return 0;
  }
}

module.exports = {
  saveDocument,
  getDocuments,
  getDocumentById,
  saveConversation,
  getConversationHistory,
  cleanupOldConversations
};
