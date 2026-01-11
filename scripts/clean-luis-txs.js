require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const userId = 16;
        const txs = await pool.query("SELECT type, amount, status, description FROM transactions WHERE user_id = $1 ORDER BY created_at ASC", [userId]);
        txs.rows.forEach(t => {
            console.log(`[${t.status}] ${t.type}: R$ ${t.amount} - ${t.description}`);
        });

        const user = await pool.query("SELECT balance FROM users WHERE id = $1", [userId]);
        console.log(`\nSALDO ATUAL NO BANCO: R$ ${user.rows[0].balance}`);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
