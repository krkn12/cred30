require('dotenv').config();

const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
const ASAAS_SANDBOX = process.env.ASAAS_SANDBOX === 'true';
const ASAAS_BASE_URL = ASAAS_SANDBOX
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';

async function testPayoutEVP() {
    console.log('=== TESTANDO TRANSFERÊNCIA PIX (EVP) ===');
    console.log('Ambiente:', ASAAS_SANDBOX ? 'SANDBOX' : 'PRODUÇÃO');

    // Chave PIX aleatória no formato UUID (EVP - Endereço Virtual de Pagamento)
    // Este é o formato aceito pelo sandbox do Asaas para testes
    const pixKey = 'adc50268-9ef7-4d96-bf7e-3ce6ad99e007';
    const pixKeyType = 'EVP';
    const amount = 1.00;

    console.log('\nDados do teste:');
    console.log('Chave PIX:', pixKey);
    console.log('Tipo:', pixKeyType);
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

testPayoutEVP();
