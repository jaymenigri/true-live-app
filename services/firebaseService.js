
const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS.replace(/\\n/g, '\n'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

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

// Não esqueça de exportar as novas funções:
module.exports = {
  // ... exportações existentes
  getUserSettings,
  updateUserSettings
};
