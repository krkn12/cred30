
const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function checkUsers() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log('✅ Connected.');

        const res = await client.query('SELECT id, name, email, balance, is_admin FROM users');
        console.log('Users found:', res.rows);

        client.release();
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await pool.end();
    }
}

checkUsers();
