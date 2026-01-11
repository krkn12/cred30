require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const userId = 16;
        const txs = await pool.query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at ASC", [userId]);
        console.log(JSON.stringify(txs.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
