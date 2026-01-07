import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Configurações do Firebase fornecidas pelo usuário
const firebaseConfig = {
  apiKey: "AIzaSyCo3TL8CiflDjqodLj9bzIv_T0ISeJomlc",
  authDomain: "cred30-prod-app-2025.firebaseapp.com",
  projectId: "cred30-prod-app-2025",
  storageBucket: "cred30-prod-app-2025.firebasestorage.app",
  messagingSenderId: "1033233821400",
  appId: "1:1033233821400:web:9bf8aa4011950a940371ad"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta as instâncias necessárias
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
