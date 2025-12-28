require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkPayoutLogs() {
    try {
        // Buscar transações de saque com seus metadados
        const res = await pool.query(`
      SELECT id, amount, status, payout_status, metadata, created_at
      FROM transactions 
      WHERE type = 'WITHDRAWAL'
      ORDER BY created_at DESC
      LIMIT 10
    `);

        console.log('=== TRANSAÇÕES DE SAQUE ===\n');

        for (const tx of res.rows) {
            console.log(`ID: ${tx.id}`);
            console.log(`Valor: R$ ${tx.amount}`);
            console.log(`Status: ${tx.status}`);
            console.log(`Payout Status: ${tx.payout_status}`);
            console.log(`Metadata:`, JSON.stringify(tx.metadata, null, 2));
            console.log('---\n');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkPayoutLogs();
