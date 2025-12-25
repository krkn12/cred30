require('dotenv').config();

const API_URL = 'http://localhost:3001/api';

async function testConfirmPayoutAPI() {
    try {
        // 1. Primeiro fazer login como admin
        console.log('1. Fazendo login como admin...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'josiassm701@gmail.com',
                password: 'admin123'
            })
        });
        const loginData = await loginRes.json();

        if (!loginData.success) {
            console.log('Login falhou:', loginData);
            return;
        }

        const token = loginData.data.token;
        console.log('Login OK! Token obtido.');

        // 2. Buscar fila de pagamentos
        console.log('\n2. Buscando fila de pagamentos...');
        const queueRes = await fetch(`${API_URL}/admin/payout-queue`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const queueData = await queueRes.json();
        console.log('Fila:', queueData);

        if (!queueData.success || !queueData.data?.transactions?.length) {
            console.log('Nenhuma transação pendente.');
            return;
        }

        const tx = queueData.data.transactions[0];
        console.log('\nTransação a confirmar:', tx.id);

        // 3. Confirmar pagamento
        console.log('\n3. Confirmando pagamento...');
        const confirmRes = await fetch(`${API_URL}/admin/confirm-payout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: tx.id,
                type: 'TRANSACTION'
            })
        });

        const confirmData = await confirmRes.json();
        console.log('Resposta:', confirmData);
        console.log('Status HTTP:', confirmRes.status);

    } catch (err) {
        console.error('Erro:', err);
    }
}

testConfirmPayoutAPI();
