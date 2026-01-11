require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const res = await pool.query("SELECT id, name FROM users WHERE name ILIKE '%Josias%' OR email ILIKE '%josias%'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
