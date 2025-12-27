import 'dotenv/config';
import { getAccountBalance } from '../src/infrastructure/gateways/asaas.service';

async function testAsaas() {
    console.log('--- Testando Conexão Asaas ---');
    console.log('API Key:', process.env.ASAAS_API_KEY ? 'Preenchida' : 'Vazia');
    console.log('Sandbox:', process.env.ASAAS_SANDBOX);

    try {
        const balance = await getAccountBalance();
        console.log('✅ Conexão estabelecida com sucesso!');
        console.log('Saldo na conta Asaas:', balance.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
        console.log('Saldo pendente:', balance.pendingBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    } catch (error) {
        console.error('❌ Erro ao conectar com Asaas:');
        console.error(error.message);
        if (error.message.includes('401')) {
            console.log('Dica: Verifique se sua ASAAS_API_KEY está correta e se bate com o modo (Produção vs Sandbox).');
        }
    }
}

testAsaas();
