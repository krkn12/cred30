const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function diagnose() {
    const client = await pool.connect();
    try {
        console.log('--- DIAGNÓSTICO DE TRANSAÇÕES ---');

        // 1. Verificar contagem por status
        const statusCounts = await client.query('SELECT status, COUNT(*) FROM transactions GROUP BY status');
        console.log('\nContagem por Status:');
        console.table(statusCounts.rows);

        // 2. Listar transações pendentes detalhadamente
        const pending = await client.query(`
      SELECT t.id, t.type, t.amount, t.status, t.payout_status, t.created_at, u.name as user
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.status IN ('PENDING', 'PENDING_CONFIRMATION')
      ORDER BY t.created_at ASC
    `);
        console.log('\nTransações Pendentes Atuais:');
        console.table(pending.rows);

        // 3. Verificar transação específica (ex: ID 1 se foi a que tentamos)
        const specificId = 1; // Ajuste se necessário
        const specific = await client.query('SELECT * FROM transactions WHERE id = $1', [specificId]);
        console.log(`\nEstado da Transação ID ${specificId}:`);
        console.table(specific.rows);

    } catch (err) {
        console.error('Erro no diagnóstico:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

diagnose();
