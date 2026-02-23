const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('packages/backend/.env'));
const serviceAccountRaw = envConfig.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccountRaw) {
    const serviceAccount = JSON.parse(serviceAccountRaw);
    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    fs.writeFileSync('firebase_credentials.json', JSON.stringify(serviceAccount, null, 2));
    console.log('Credencial corrigida e salva em firebase_credentials.json');
} else {
    console.log('FIREBASE_SERVICE_ACCOUNT não encontrado no .env');
}
