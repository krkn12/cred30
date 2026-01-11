require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        console.log('--- Últimos Empréstimos ---');
        const loans = await pool.query("SELECT * FROM loans ORDER BY created_at DESC LIMIT 10");
        console.log(loans.rows);

        console.log('\n--- Configuração de Liquidez do Sistema ---');
        const config = await pool.query("SELECT * FROM system_config LIMIT 1");
        console.log(config.rows[0]);

        console.log('\n--- Total em Empréstimos Ativos ---');
        const activeLoans = await pool.query("SELECT SUM(amount) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')");
        console.log(activeLoans.rows[0]);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
