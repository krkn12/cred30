require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkUserBalance() {
    try {
        const res = await pool.query(`
      SELECT id, name, email, balance FROM users WHERE id = 2
    `);
        console.log('User 2 info:', res.rows[0]);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkUserBalance();
