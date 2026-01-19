const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function test() {
    console.log('--- DB TEST START ---');
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('NOW:', res.rows[0]);

        console.log('DELETING TEST USER...');
        const delRes = await pool.query("DELETE FROM users WHERE email = $1", ['admin@cred30.site']);
        console.log('DELETE RESULT:', delRes.rowCount);
    } catch (err) {
        console.error('DB TEST ERROR:', err.message);
    } finally {
        await pool.end();
        console.log('--- DB TEST END ---');
    }
}

test();
