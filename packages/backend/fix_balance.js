require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function fixBalance() {
    try {
        // Get the sell transaction amount that wasn't credited
        const res = await pool.query(`SELECT balance FROM users WHERE id = 2`);
        console.log('Before fix - Balance:', res.rows[0].balance);

        // Credit the 25.20 that should have been credited from the sell
        await pool.query(`UPDATE users SET balance = balance + 25.20 WHERE id = 2`);

        const after = await pool.query(`SELECT balance FROM users WHERE id = 2`);
        console.log('After fix - Balance:', after.rows[0].balance);

        console.log('Balance corrected!');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

fixBalance();
