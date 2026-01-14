require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function debugProfit() {
    try {
        console.log('\n=== DIVIDENDS ===');
        const divs = await pool.query("SELECT * FROM transactions WHERE type = 'DIVIDEND'");
        divs.rows.forEach(r => console.log(`ID: ${r.id} | Amount: ${r.amount} | Desc: ${r.description}`));

        console.log('\n=== LOAN REPAYMENTS ===');
        const loans = await pool.query("SELECT * FROM transactions WHERE type = 'LOAN_REPAYMENT'");
        loans.rows.forEach(r => console.log(`ID: ${r.id} | Amount: ${r.amount} | Meta: ${JSON.stringify(r.metadata)}`));

        console.log('\n=== SYSTEM CONFIG ===');
        const config = await pool.query('SELECT * FROM system_config');
        console.log(config.rows[0]);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

debugProfit();
