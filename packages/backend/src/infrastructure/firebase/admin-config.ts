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
            console.log('[Firebase] Detectado FIREBASE_SERVICE_ACCOUNT no ambiente.');
            let serviceAccountData = process.env.FIREBASE_SERVICE_ACCOUNT;
            // Remover aspas simples extras se existirem (comum em alguns ambientes)
            if (typeof serviceAccountData === 'string' && serviceAccountData.startsWith("'") && serviceAccountData.endsWith("'")) {
                serviceAccountData = serviceAccountData.slice(1, -1);
            }

            try {
                const serviceAccount = JSON.parse(serviceAccountData);

                // CORREÇÃO CRÍTICA: Substituir literais de quebra de linha por quebras reais no private_key
                if (serviceAccount.private_key) {
                    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
                }
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
                console.log('Firebase Admin inicializado com sucesso para o projeto:', serviceAccount.project_id);
            } catch (jsonErr: any) {
                console.error('[Firebase] Erro ao processar JSON da Service Account:', jsonErr.message);
                console.error('[Firebase] Início da string (primeiros 50 chars):', serviceAccountData.substring(0, 50));
            }
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
