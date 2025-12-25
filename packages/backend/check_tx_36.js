require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkTransaction36() {
    try {
        const res = await pool.query('SELECT id, payout_status, status, metadata FROM transactions WHERE id = 36');
        console.log('Transação 36:');
        console.log(res.rows[0]);
    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await pool.end();
    }
}

checkTransaction36();
