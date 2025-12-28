require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function confirmTx36() {
    try {
        // Confirmar transação 36
        await pool.query(`
      UPDATE transactions 
      SET payout_status = 'PAID', 
          processed_at = NOW(),
          metadata = metadata || '{"payout_method": "MANUAL", "confirmed_at": "${new Date().toISOString()}"}'::jsonb
      WHERE id = 36
    `);

        console.log('✅ Transação 36 confirmada como PAID!');

        // Verificar
        const res = await pool.query('SELECT id, payout_status FROM transactions WHERE id = 36');
        console.log('Novo status:', res.rows[0]);

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await pool.end();
    }
}

confirmTx36();
