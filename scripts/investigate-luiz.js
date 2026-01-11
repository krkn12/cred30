require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        console.log('--- Buscando usuário Luiz ---');
        const users = await pool.query("SELECT id, name, email, balance, score FROM users WHERE name ILIKE '%luiz%' OR email ILIKE '%luiz%'");
        console.log('Usuários encontrados:', users.rows);

        for (const user of users.rows) {
            console.log(`\n=== Detalhes para: ${user.name} (ID: ${user.id}) ===`);

            const quotas = await pool.query("SELECT * FROM quotas WHERE user_id = $1", [user.id]);
            console.log('--- Cotas ---');
            console.log(quotas.rows);

            const txs = await pool.query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC", [user.id]);
            console.log('--- Transações ---');
            console.log(txs.rows);

            const deposits = await pool.query("SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC", [user.id]);
            console.log('--- Depósitos ---');
            console.log(deposits.rows);

            const loans = await pool.query("SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC", [user.id]);
            console.log('--- Empréstimos ---');
            console.log(loans.rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
