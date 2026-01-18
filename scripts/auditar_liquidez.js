const { Client } = require('pg');

const url = 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const client = new Client({ connectionString: url });

async function auditarLiquidez() {
    try {
        await client.connect();

        // Buscar system_config
        const configRes = await client.query('SELECT * FROM system_config LIMIT 1');
        const config = configRes.rows[0] || {};

        // Buscar somas
        const statsRes = await client.query(`
            SELECT 
                (SELECT COALESCE(SUM(CAST(balance AS NUMERIC)), 0) FROM users) as total_user_balances,
                (SELECT COALESCE(SUM(amount), 0) FROM system_costs) as total_monthly_costs
        `);
        const stats = statsRes.rows[0];

        console.log('\n========================================');
        console.log('🔍 AUDITORIA DE LIQUIDEZ REAL');
        console.log('========================================\n');

        console.log('📊 SYSTEM_CONFIG:');
        console.log('  system_balance:', Number(config.system_balance || 0).toFixed(2));
        console.log('  total_tax_reserve:', Number(config.total_tax_reserve || 0).toFixed(2));
        console.log('  total_operational_reserve:', Number(config.total_operational_reserve || 0).toFixed(2));
        console.log('  total_owner_profit:', Number(config.total_owner_profit || 0).toFixed(2));
        console.log('  mutual_reserve:', Number(config.mutual_reserve || 0).toFixed(2));
        console.log('  investment_reserve:', Number(config.investment_reserve || 0).toFixed(2));
        console.log('  real_liquidity (gravado):', Number(config.real_liquidity || 0).toFixed(2));

        console.log('\n📊 SOMAS CALCULADAS:');
        console.log('  total_user_balances:', Number(stats.total_user_balances || 0).toFixed(2));
        console.log('  total_monthly_costs:', Number(stats.total_monthly_costs || 0).toFixed(2));

        console.log('\n🧮 CÁLCULO MANUAL:');
        const systemBalance = Number(config.system_balance || 0);
        const taxReserve = Number(config.total_tax_reserve || 0);
        const operReserve = Number(config.total_operational_reserve || 0);
        const profitReserve = Number(config.total_owner_profit || 0);
        const mutualReserve = Number(config.mutual_reserve || 0);
        const investReserve = Number(config.investment_reserve || 0);
        const monthlyCosts = Number(stats.total_monthly_costs || 0);
        const userBalances = Number(stats.total_user_balances || 0);

        const totalReservas = taxReserve + operReserve + profitReserve + mutualReserve + investReserve + monthlyCosts + userBalances;
        const liquidezCalculada = systemBalance - totalReservas;

        console.log('  System Balance:               ', systemBalance.toFixed(2));
        console.log('  - Reserva Impostos:           ', taxReserve.toFixed(2));
        console.log('  - Reserva Operacional:        ', operReserve.toFixed(2));
        console.log('  - Lucro Proprietário:         ', profitReserve.toFixed(2));
        console.log('  - Reserva Mútua:              ', mutualReserve.toFixed(2));
        console.log('  - Reserva Investimento:       ', investReserve.toFixed(2));
        console.log('  - Custos Mensais:             ', monthlyCosts.toFixed(2));
        console.log('  - Saldos de Usuários:         ', userBalances.toFixed(2));
        console.log('  ----------------------------------------');
        console.log('  = Total Reservas:             ', totalReservas.toFixed(2));
        console.log('  ----------------------------------------');
        console.log('  💰 LIQUIDEZ REAL CALCULADA:   ', liquidezCalculada.toFixed(2));

        console.log('\n✅ COMPARAÇÃO:');
        console.log('  Liquidez gravada no BD:  ', Number(config.real_liquidity || 0).toFixed(2));
        console.log('  Liquidez calculada agora:', liquidezCalculada.toFixed(2));

        if (Math.abs(liquidezCalculada - Number(config.real_liquidity || 0)) < 0.01) {
            console.log('  Status: ✅ MATCH PERFEITO!');
        } else {
            console.log('  Status: ❌ DIFERENÇA ENCONTRADA!');
        }

        console.log('\n========================================\n');

    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await client.end();
    }
}

auditarLiquidez();
