require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function fixPendingWithdrawals() {
    try {
        const newPixKey = '24146064287';

        // Atualizar os metadados dos saques pendentes
        const result = await pool.query(`
      UPDATE transactions 
      SET metadata = jsonb_set(metadata, '{pixKey}', $1::jsonb)
      WHERE type = 'WITHDRAWAL' 
        AND payout_status = 'PENDING_PAYMENT'
      RETURNING id, metadata
    `, [JSON.stringify(newPixKey)]);

        console.log('Saques atualizados:', result.rowCount);
        result.rows.forEach(row => {
            console.log('ID:', row.id, '- Nova chave:', row.metadata.pixKey);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

fixPendingWithdrawals();
