require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        console.log('--- Listando todos os usuários ---');
        const users = await pool.query("SELECT id, name, email, balance, score FROM users ORDER BY created_at DESC");
        console.log(users.rows);

        const luiz = users.rows.find(u => u.name.toLowerCase().includes('luiz') || u.name.toLowerCase().includes('luis'));
        if (luiz) {
            console.log(`\n--- Usuário encontrado: ${luiz.name} (ID: ${luiz.id}) ---`);
            const quotas = await pool.query("SELECT id, user_id, status, value, created_at FROM quotas WHERE user_id = $1", [luiz.id]);
            console.log('Cotas:', quotas.rows);

            const deposits = await pool.query("SELECT id, user_id, amount, status, created_at FROM deposits WHERE user_id = $1 or (metadata->>'user_email') = $2", [luiz.id, luiz.email]);
            console.log('Depósitos:', deposits.rows);

            const txs = await pool.query("SELECT id, user_id, type, amount, status, description, created_at FROM transactions WHERE user_id = $1 ORDER BY created_at DESC", [luiz.id]);
            console.log('Transações:', txs.rows);
        } else {
            console.log('Nenhum Luiz ou Luis encontrado.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
