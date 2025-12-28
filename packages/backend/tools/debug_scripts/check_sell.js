require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkSellTransactions() {
    try {
        // Check recent SELL transactions
        const res = await pool.query(`
      SELECT id, user_id, type, amount, description, status, created_at
      FROM transactions 
      WHERE user_id = 2 AND type IN ('SELL_QUOTA', 'QUOTA_SALE')
      ORDER BY created_at DESC 
      LIMIT 10
    `);
        console.log('Recent SELL transactions for user 2:');
        console.log(res.rows);

        // Check all quotas for user
        const quotas = await pool.query(`
      SELECT id, status, purchase_price, current_value
      FROM quotas WHERE user_id = 2
    `);
        console.log('\nAll quotas for user 2:');
        console.log(quotas.rows);

        // Check user balance
        const user = await pool.query(`SELECT balance FROM users WHERE id = 2`);
        console.log('\nUser 2 balance:', user.rows[0].balance);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkSellTransactions();
