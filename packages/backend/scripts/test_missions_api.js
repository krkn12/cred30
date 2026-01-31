
const axios = require('axios');

async function testApi() {
    try {
        console.log('--- Testando API de Missões ---');
        // Usando o token do Josias (se eu conseguir pegar do log ou ambiente, mas aqui vou tentar sem auth primeiro pra ver se retorna 401 ou 500)
        const baseUrl = 'http://localhost:3001/api';
        const response = await axios.get(`${baseUrl}/marketplace/logistic/missions`, {
            validateStatus: false
        });
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Erro no teste:', error.message);
    }
}

testApi();
