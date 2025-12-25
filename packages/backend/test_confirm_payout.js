require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function testConfirmPayout() {
    try {
        // 1. Buscar uma transação pendente de pagamento
        const pending = await pool.query(`
      SELECT t.id, t.amount, t.payout_status, t.metadata, u.name, u.pix_key
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.payout_status = 'PENDING_PAYMENT'
      LIMIT 1
    `);

        if (pending.rows.length === 0) {
            console.log('Nenhuma transação pendente de pagamento encontrada.');
            return;
        }

        const tx = pending.rows[0];
        console.log('Transação pendente encontrada:');
        console.log('ID:', tx.id);
        console.log('Usuário:', tx.name);
        console.log('PIX Key:', tx.pix_key);
        console.log('Valor:', tx.amount);
        console.log('Metadata:', tx.metadata);

        // 2. Simular a confirmação (atualizar status para PAID)
        console.log('\n--- Confirmando pagamento ---');

        await pool.query(`
      UPDATE transactions 
      SET payout_status = 'PAID', 
          processed_at = NOW(),
          metadata = metadata || '{"payout_method": "MANUAL_TEST", "confirmed_at": "${new Date().toISOString()}"}'::jsonb
      WHERE id = $1
    `, [tx.id]);

        console.log('✅ Transação', tx.id, 'confirmada como PAID!');

        // 3. Verificar resultado
        const updated = await pool.query('SELECT id, payout_status, metadata FROM transactions WHERE id = $1', [tx.id]);
        console.log('\nNovo status:', updated.rows[0].payout_status);

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await pool.end();
    }
}

testConfirmPayout();
