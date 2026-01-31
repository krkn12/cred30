const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cred30'
});

async function checkUser() {
    try {
        const res = await pool.query("SELECT id, name, balance, security_lock_until, is_verified FROM users WHERE name ILIKE '%Josias%'");
        console.log('User found:', JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pool.end();
    }
}

checkUser();
