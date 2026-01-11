require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const userId = 16;
        const txs = await pool.query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at ASC", [userId]);
        txs.rows.forEach(t => {
            console.log(`[${t.status}] ${t.type} | R$ ${t.amount} | ${t.description}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
