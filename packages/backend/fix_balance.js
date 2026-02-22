const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_r2ONaiq8dpRW@ep-divine-surf-ai9icfnr.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    ssl: { rejectUnauthorized: false }
});

async function fixInconsistency() {
    const client = await pool.connect();
    try {
        console.log('🔄 Corrigindo as reservas fantasmas para equilibrar a contabilidade...');
        await client.query(`
            UPDATE system_config SET 
                system_balance = 0,
                profit_pool = 0,
                investment_reserve = 0,
                total_tax_reserve = 0,
                total_operational_reserve = 0,
                total_owner_profit = 0,
                total_corporate_investment_reserve = 0,
                mutual_reserve = 0,
                credit_guarantee_fund = 0
            WHERE id = (SELECT id FROM system_config LIMIT 1)
        `);
        console.log('✅ Reservas do NeonDB resetadas com sucesso para R$ 0,00.');
    } catch (e) {
        console.error('❌ Erro:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

fixInconsistency();
