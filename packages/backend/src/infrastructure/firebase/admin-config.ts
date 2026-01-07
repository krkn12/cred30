import * as admin from 'firebase-admin';

/**
 * Inicializa o Firebase Admin SDK
 * É necessário o arquivo de credenciais (Service Account JSON) ou variáveis de ambiente.
 */
export const initializeFirebaseAdmin = () => {
    if (admin.apps.length > 0) return;

    try {
        // Se houver as credenciais no .env, inicializa
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            let serviceAccountData = process.env.FIREBASE_SERVICE_ACCOUNT;
            // Remover aspas simples extras se existirem (comum em alguns ambientes)
            if (typeof serviceAccountData === 'string' && serviceAccountData.startsWith("'") && serviceAccountData.endsWith("'")) {
                serviceAccountData = serviceAccountData.slice(1, -1);
            }
            const serviceAccount = JSON.parse(serviceAccountData);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('Firebase Admin inicializado com Service Account do .env');
        } else {
            // Tenta inicializar com credenciais padrão (útil em ambientes como Google Cloud)
            admin.initializeApp();
            console.log('Firebase Admin inicializado com Application Default Credentials');
        }
    } catch (error) {
        console.error('Erro ao inicializar Firebase Admin:', error);
    }
};

export const firebaseAdmin = admin;
