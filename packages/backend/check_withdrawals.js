require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkWithdrawalTransactions() {
    try {
        const res = await pool.query(`
      SELECT id, user_id, type, amount, description, status, metadata, created_at
      FROM transactions 
      WHERE type = 'WITHDRAWAL'
      ORDER BY created_at DESC 
      LIMIT 5
    `);
        console.log('Recent WITHDRAWAL transactions:');
        res.rows.forEach(row => {
            console.log('---');
            console.log('ID:', row.id);
            console.log('Amount:', row.amount);
            console.log('Status:', row.status);
            console.log('Metadata:', JSON.stringify(row.metadata, null, 2));
        });
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkWithdrawalTransactions();
