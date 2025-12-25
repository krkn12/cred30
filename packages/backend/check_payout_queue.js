require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkPayoutQueue() {
    try {
        const res = await pool.query(`
      SELECT t.id, t.amount, t.payout_status, t.status, t.metadata, u.name as user_name
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.payout_status = 'PENDING_PAYMENT'
      ORDER BY t.created_at DESC
    `);
        console.log('Payout Queue:');
        res.rows.forEach(row => {
            console.log('---');
            console.log('ID:', row.id);
            console.log('User:', row.user_name);
            console.log('Amount (from column):', row.amount);
            console.log('Status:', row.status);
            console.log('Payout Status:', row.payout_status);
            console.log('Metadata:', JSON.stringify(row.metadata, null, 2));
        });
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkPayoutQueue();
