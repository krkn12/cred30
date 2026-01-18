
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: true
});

async function adjustBalance() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Localizar Carlos Bruno
        const findUser = await client.query('SELECT id, name, balance FROM users WHERE name ILIKE $1', ['%Carlos Bruno%']);

        if (findUser.rows.length === 0) {
            console.log('USUARIO_NAO_ENCONTRADO');
            return;
        }

        const user = findUser.rows[0];
        console.log(`USUARIO_ENCONTRADO: ${user.name} (ID: ${user.id}) | Saldo Atual: ${user.balance}`);

        // 2. Atualizar Saldo
        const newBalance = parseFloat(user.balance) - 150;
        await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user.id]);

        // 3. Registrar Transação (Auditoria)
        await client.query(`
      INSERT INTO transactions (user_id, type, amount, description, status, metadata)
      VALUES ($1, 'WITHDRAWAL', 150, 'Ajuste manual solicitado pelo administrador', 'APPROVED', $2)
    `, [user.id, JSON.stringify({ manual_adjustment: true, reason: 'Solicitação Josias' })]);

        await client.query('COMMIT');
        console.log(`SUCESSO: Novo saldo de ${user.name} é R$ ${newBalance.toFixed(2)}`);

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('ERRO:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

adjustBalance();
