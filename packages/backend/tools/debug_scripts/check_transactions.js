require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkRecentTransactions() {
    try {
        const res = await pool.query(`
      SELECT id, user_id, type, amount, description, status, created_at, metadata
      FROM transactions 
      WHERE type = 'BUY_QUOTA' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
        console.log('Recent BUY_QUOTA transactions:');
        res.rows.forEach(row => {
            console.log('---');
            console.log('ID:', row.id);
            console.log('Status:', row.status);
            console.log('Amount:', row.amount);
            console.log('Description:', row.description);
            console.log('Created:', row.created_at);
            if (row.metadata) {
                const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
                console.log('Payment ID (Asaas):', meta.mp_id || 'N/A');
                console.log('Payment Method:', meta.paymentMethod || 'N/A');
            }
        });
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkRecentTransactions();
