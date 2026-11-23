// Configuração da nuvem (Firebase, projeto "Seu Trem atendimento 1", plano Spark gratuito).
// Firestore em São Paulo (southamerica-east1), login anônimo ligado, regras em firestore.rules.
// A apiKey do Firebase web é um identificador público (não é senha); o acesso é controlado pelas regras.
// Para ensaiar sem nuvem, troque por: window.FIREBASE_CONFIG = null;
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyC1lO-j4HILhVBtX_O_KWAoQa8FEHZlvrI",
  authDomain: "seu-trem-atendimento-1.firebaseapp.com",
  projectId: "seu-trem-atendimento-1",
  storageBucket: "seu-trem-atendimento-1.firebasestorage.app",
  messagingSenderId: "870681576174",
  appId: "1:870681576174:web:7cc76460081ee8de1069ff"
};

// Loja deste endereço. Seu Trem = st1. Cada loja futura (Lado B físico, franquias) ganha o seu código.
window.LOJA_ID = 'st1';
