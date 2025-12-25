require('dotenv').config();

const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
const ASAAS_SANDBOX = process.env.ASAAS_SANDBOX === 'true';
const ASAAS_BASE_URL = ASAAS_SANDBOX
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';

async function testPayout() {
    console.log('=== TESTANDO TRANSFERÊNCIA PIX ===');
    console.log('Ambiente:', ASAAS_SANDBOX ? 'SANDBOX' : 'PRODUÇÃO');

    // Chave PIX corrigida (CPF de 11 dígitos)
    const pixKey = '24146064287';
    const pixKeyType = 'CPF';
    const amount = 1.00; // Valor de teste mínimo

    console.log('\nDados do teste:');
    console.log('Chave PIX:', pixKey);
    console.log('Tipo detectado:', pixKeyType);
    console.log('Valor:', amount);

    try {
        const response = await fetch(`${ASAAS_BASE_URL}/transfers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY,
            },
            body: JSON.stringify({
                value: amount,
                pixAddressKey: pixKey,
                pixAddressKeyType: pixKeyType,
                description: 'Teste de Saque Cred30',
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.log('\n❌ ERRO na transferência:');
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log('\n✅ Transferência criada com sucesso!');
            console.log(JSON.stringify(data, null, 2));
        }

    } catch (err) {
        console.error('Erro:', err);
    }
}

testPayout();
