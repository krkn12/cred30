
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../packages/backend/.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function diagnose() {
    try {
        console.log('🔍 INICIANDO DIAGNÓSTICO DE LIQUIDEZ...\n');

        // 1. Buscar System Config
        const configRes = await pool.query('SELECT * FROM system_config LIMIT 1');
        const config = configRes.rows[0];

        // 2. Buscar Dados Agregados
        const userBalancesRes = await pool.query('SELECT COALESCE(SUM(balance), 0) as total FROM users');
        const systemCostsRes = await pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM system_costs');

        // Converter para float
        const systemBalance = parseFloat(config.system_balance);
        const taxReserve = parseFloat(config.total_tax_reserve);
        const opReserve = parseFloat(config.total_operational_reserve);
        const ownerProfit = parseFloat(config.total_owner_profit);
        const investReserve = parseFloat(config.investment_reserve || 0);
        const profitPool = parseFloat(config.profit_pool || 0);

        const userBalances = parseFloat(userBalancesRes.rows[0].total);
        const monthlyCosts = parseFloat(systemCostsRes.rows[0].total);

        // Calcular Passivos Totais (O que o sistema deve ou está comprometido)
        // Nota: Investment Reserve e Profit Pool não estavam na fórmula original do controller, 
        // mas tecnicamente também são compromissos se não forem "dinheiro livre".
        // Vamos replicar A FÓRMULA DO CONTROLLER primeiro.

        const liabilitiesController = taxReserve + opReserve + ownerProfit + monthlyCosts + userBalances;
        const realLiquidityController = systemBalance - liabilitiesController;

        console.log('--- DADOS ATUAIS (Baseados em admin.finance.controller.ts) ---');
        console.log(`💰 Saldo do Sistema (System Balance): R$ ${systemBalance.toFixed(2)}`);
        console.log(`\n📉 PASSIVOS (Compromissos):`);
        console.log(`   - Saldos dos Usuários:    R$ ${userBalances.toFixed(2)}`);
        console.log(`   - Reserva Fiscal:         R$ ${taxReserve.toFixed(2)}`);
        console.log(`   - Reserva Operacional:    R$ ${opReserve.toFixed(2)}`);
        console.log(`   - Lucro do Dono (Retido): R$ ${ownerProfit.toFixed(2)}`);
        console.log(`   - Custos Mensais (Abertos): R$ ${monthlyCosts.toFixed(2)}`);
        console.log(`   -------------------------------------------`);
        console.log(`   = TOTAL PASSIVOS:         R$ ${liabilitiesController.toFixed(2)}`);

        console.log(`\n📊 RESULTADO:`);
        console.log(`   Liquidez Real = Balance - Passivos`);
        console.log(`   R$ ${realLiquidityController.toFixed(2)}`);

        console.log('\n--- OUTRAS RESERVAS (Não subtraídas na fórmula atual, mas existem) ---');
        console.log(`   - Reserva de Investimento: R$ ${investReserve.toFixed(2)}`);
        console.log(`   - Pool de Lucros (Sobras): R$ ${profitPool.toFixed(2)}`);

        console.log('\n--- ANÁLISE ---');
        if (realLiquidityController < 0) {
            console.log('⚠️  LIQUIDEZ NEGATIVA DETECTADA!');
            console.log('   Significa que o dinheiro "físico" (System Balance) é menor que a soma das dívidas (Saldos + Reservas).');
            console.log('   Possíveis causas:');
            console.log('   1. Bônus de boas-vindas dados sem injeção de capital correspondente.');
            console.log('   2. Adição manual de saldo a usuários sem atualizar system_balance.');
            console.log('   3. Custos cadastrados (mensais) que ainda não foram pagos mas já abatem da liquidez visual.');

            const diff = Math.abs(realLiquidityController);
            console.log(`\n💡 SOLUÇÃO SUGERIDA:`);
            console.log(`   Para zerar, você precisa INJETAR R$ ${diff.toFixed(2)} no sistema.`);
            console.log(`   Você pode usar a função de "Adicionar Lucro/Capital" no painel, ou rodar um script de ajuste.`);
        } else {
            console.log('✅ Liquidez Positiva. O sistema está saudável.');
        }

    } catch (error) {
        console.error('Erro no diagnóstico:', error);
    } finally {
        await pool.end();
    }
}

diagnose();
