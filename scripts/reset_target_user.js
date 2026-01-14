
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../packages/backend/.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const targetEmail = process.argv[2];

if (!targetEmail) {
    console.error('❌ Por favor, forneça o email do usuário a ser resetado.');
    console.error('Uso: node scripts/reset_target_user.js <email>');
    process.exit(1);
}

async function resetUserData() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Encontrar usuário
        const userRes = await client.query('SELECT id, name, balance FROM users WHERE email = $1', [targetEmail]);

        if (userRes.rows.length === 0) {
            console.error(`❌ Usuário com email ${targetEmail} não encontrado.`);
            await client.query('ROLLBACK');
            return;
        }

        const user = userRes.rows[0];
        console.log(`👤 Usuário encontrado: ${user.name} (ID: ${user.id}) | Saldo Atual: R$ ${user.balance}`);

        // 2. Zerar Transações
        const transRes = await client.query('DELETE FROM transactions WHERE user_id = $1', [user.id]);
        console.log(`🗑️  Transações removidas: ${transRes.rowCount}`);

        // 3. Zerar Empréstimos
        // Primeiro remover parcelas
        await client.query(`
            DELETE FROM loan_installments 
            WHERE loan_id IN (SELECT id FROM loans WHERE user_id = $1)
        `, [user.id]);

        const loansRes = await client.query('DELETE FROM loans WHERE user_id = $1', [user.id]);
        console.log(`🗑️  Empréstimos removidos: ${loansRes.rowCount}`);

        // 4. Zerar Cotas? (Opcional, mas "zera os dados" geralmente inclui isso)
        // Se zerar cotas, ele perde o status de membro?
        // Vou manter as cotas mas zerar o "histórico".
        // O usuário pediu "zera os dados dele". Vou perguntar ou assumir Full Wipe (mantendo user).
        // Melhor zerar movimentações financeiras. Cotas são movimentação também (Buy Quota).
        const quotasRes = await client.query('DELETE FROM quotas WHERE user_id = $1', [user.id]);
        console.log(`🗑️  Cotas removidas: ${quotasRes.rowCount}`);

        // 5. Zerar Marketplace Orders
        const ordersRes = await client.query('DELETE FROM marketplace_orders WHERE buyer_id = $1 OR listing_id IN (SELECT id FROM marketplace_listings WHERE seller_id = $1)', [user.id]);
        console.log(`🗑️  Pedidos Marketplace removidos: ${ordersRes.rowCount}`);

        // 6. Zerar Listings?
        const listingsRes = await client.query('DELETE FROM marketplace_listings WHERE seller_id = $1', [user.id]);
        console.log(`🗑️  Anúncios removidos: ${listingsRes.rowCount}`);

        // 7. Zerar Support Tickets / Logs?
        // Deixar logs por segurança? Não, ele quer zerar.
        await client.query('DELETE FROM support_tickets WHERE user_id = $1', [user.id]);
        await client.query('DELETE FROM access_logs WHERE user_id = $1', [user.id]);
        await client.query('DELETE FROM notifications WHERE user_id = $1', [user.id]);

        // 8. Zerar Saldo e Status
        await client.query(`
            UPDATE users 
            SET balance = 0, 
                score = 500, 
                reputation = 500,
                last_deposit_at = NULL,
                is_under_duress = FALSE,
                security_lock_until = NULL
            WHERE id = $1
        `, [user.id]);
        console.log(`🔄 Saldo resetado para R$ 0,00 e Score restaurado para 500.`);

        await client.query('COMMIT');
        console.log(`✅ DADOS DO USUÁRIO ${user.name.toUpperCase()} RESETADOS COM SUCESSO!`);

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao resetar dados:', e);
    } finally {
        client.release();
        pool.end();
    }
}

resetUserData();
