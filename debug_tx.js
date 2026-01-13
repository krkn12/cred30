const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function run() {
    try {
        const res = await pool.query("SELECT * FROM transactions WHERE user_id = 31 AND status = 'PENDING' AND type = 'LOAN_PAYMENT'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
