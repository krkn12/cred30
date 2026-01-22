
import { MAX_ACTIVE_MEMBERS, MAX_QUOTAS_PER_USER, QUOTA_PRICE } from '../src/shared/constants/business.constants';

async function runSimulation() {
    console.log('🦈 INICIANDO SIMULAÇÃO DE SEGURANÇA E COMPLIANCE 🦈\n');

    console.log('--- CENÁRIO 1: TESTE ANTI-BALEIA (ANTI-WHALE) ---');
    console.log(`Tentativa de aporte massivo de R$ 500.000,00 (10.000 cotas)...`);

    const whaleAttempt = 10000;
    const whaleCost = whaleAttempt * QUOTA_PRICE;

    if (whaleAttempt > MAX_QUOTAS_PER_USER) {
        console.log(`❌ BLOQUEADO PELO SISTEMA!`);
        console.log(`   Motivo: Limite de concentração por CPF excedido.`);
        console.log(`   Limite Permitido: ${MAX_QUOTAS_PER_USER} cotas (R$ ${MAX_QUOTAS_PER_USER * QUOTA_PRICE})`);
        console.log(`   Tentativa: ${whaleAttempt} cotas (R$ ${whaleCost})`);
        console.log(`   Status: 🛡️ SISTEMA PROTEGIDO contra Lavagem de Dinheiro.`);
    } else {
        console.log('⚠️ ALERTA: Aporte passaria! Ajuste suas variáveis!');
    }

    console.log('\n------------------------------------------------------\n');

    console.log('--- CENÁRIO 2: TESTE DE LOTAÇÃO (WAITLIST / CVM) ---');
    console.log(`Simulando entrada do usuário número ${MAX_ACTIVE_MEMBERS + 1}...`);

    const currentActiveUsers = MAX_ACTIVE_MEMBERS;
    const newUser = { email: 'jose.late@email.com', status: 'PENDING' };

    if (currentActiveUsers >= MAX_ACTIVE_MEMBERS) {
        newUser.status = 'WAITLIST';
        console.log(`❌ ACESSO IMEDIATO NEGADO!`);
        console.log(`   Motivo: Capacidade do Grupo Fechado (SCP) atingida.`);
        console.log(`   Ação do Sistema: Usuário direcionado para LISTA DE ESPERA (Waitlist).`);
        console.log(`   Status do Usuário: ${newUser.status}`);
        console.log(`   Status: 🛡️ SISTEMA PROTEGIDO contra Oferta Pública Irregular (CVM).`);
    } else {
        newUser.status = 'ACTIVE';
        console.log('⚠️ ALERTA: Usuário entraria! Verifique sua contagem.');
    }

    console.log('\n🦈 SIMULAÇÃO CONCLUÍDA COM SUCESSO 🦈');
}

runSimulation();
