require('dotenv').config();

const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
const ASAAS_SANDBOX = process.env.ASAAS_SANDBOX === 'true';
const ASAAS_BASE_URL = ASAAS_SANDBOX
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';

async function checkAsaasBalance() {
    console.log('=== VERIFICANDO CONTA ASAAS ===');
    console.log('Ambiente:', ASAAS_SANDBOX ? 'SANDBOX' : 'PRODUÇÃO');
    console.log('API Key (primeiros chars):', ASAAS_API_KEY.substring(0, 20) + '...');

    try {
        // 1. Verificar saldo
        console.log('\n--- Saldo da Conta ---');
        const balanceRes = await fetch(`${ASAAS_BASE_URL}/finance/balance`, {
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY,
            }
        });
        const balance = await balanceRes.json();
        console.log('Resposta:', JSON.stringify(balance, null, 2));

        // 2. Listar últimas transferências (payouts)
        console.log('\n--- Últimas Transferências (Payouts) ---');
        const transfersRes = await fetch(`${ASAAS_BASE_URL}/transfers?limit=5`, {
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY,
            }
        });
        const transfers = await transfersRes.json();
        console.log('Resposta:', JSON.stringify(transfers, null, 2));

        // 3. Listar últimos pagamentos recebidos
        console.log('\n--- Últimos Pagamentos Recebidos ---');
        const paymentsRes = await fetch(`${ASAAS_BASE_URL}/payments?limit=5`, {
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY,
            }
        });
        const payments = await paymentsRes.json();
        console.log('Resposta:', JSON.stringify(payments, null, 2));

    } catch (err) {
        console.error('Erro:', err);
    }
}

checkAsaasBalance();
