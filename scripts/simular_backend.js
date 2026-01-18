const { Client } = require('pg');

const url = 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const client = new Client({ connectionString: url });

async function simularBackend() {
    try {
        await client.connect();
        console.log('\n🔧 SIMULANDO BACKEND - CÁLCULO DE LIQUIDEZ\n');

        // Simular exatamente o que o backend faz (linha ~230)
        const stats = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE') as quotas_count,
                (SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_loaned,
                (SELECT COALESCE(SUM(CAST(balance AS NUMERIC)), 0) FROM users) as total_user_balances,
                (SELECT COALESCE(SUM(amount), 0) FROM system_costs) as total_monthly_costs,
                (SELECT COUNT(*) FROM governance_proposals WHERE status = 'active') as active_proposals_count
        `);

        const row = stats.rows[0];

        // QUOTA_SHARE_VALUE = 42
        const QUOTA_SHARE_VALUE = 42;

        // FÓRMULA FINAL (linha ~249-253)
        const activeQuotasCount = Number(row.quotas_count || 0);
        const totalCapitalSocial = activeQuotasCount * QUOTA_SHARE_VALUE;
        const totalEmprestimos = Number(row.total_loaned || 0);

        const realLiquidity = totalCapitalSocial - totalEmprestimos;

        console.log('📊 DADOS DA QUERY:');
        console.log('  quotas_count:', row.quotas_count);
        console.log('  total_loaned:', row.total_loaned);
        console.log('  total_user_balances:', row.total_user_balances);

        console.log('\n🧮 CÁLCULO:');
        console.log('  Cotas Ativas:', activeQuotasCount);
        console.log('  × R$ 42 (QUOTA_SHARE_VALUE)');
        console.log('  = Capital Social: R$', totalCapitalSocial.toFixed(2));
        console.log('  - Empréstimos: R$', totalEmprestimos.toFixed(2));
        console.log('  ----------------------------------------');
        console.log('  💰 LIQUIDEZ REAL: R$', realLiquidity.toFixed(2));

        if (realLiquidity === 14) {
            console.log('\n✅ CORRETO! Liquidez = +R$ 14,00');
        } else {
            console.log('\n❌ ERRO! Esperado: +R$ 14,00, Calculado: R$', realLiquidity.toFixed(2));
        }

    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await client.end();
    }
}

simularBackend();
