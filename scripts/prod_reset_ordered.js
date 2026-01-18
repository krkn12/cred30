
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });
    const ADMIN_ID = 1;

    await client.connect();
    console.log('--- RESET GLOBAL: ORDENADO PARA PRODUÇÃO ---');

    // Ordem manual para evitar erros de FK
    const orderedTables = [
        'loan_installments', 'loans',
        'consortium_votes', 'consortium_bids', 'consortium_members', 'consortium_withdrawals',
        'consortium_assemblies', 'consortium_groups',
        'marketplace_order_items', 'marketplace_reviews', 'marketplace_questions',
        'marketplace_favorites', 'marketplace_orders', 'marketplace_listings',
        'marketplace_sellers', 'marketplace_coupons',
        'courier_applications', 'couriers',
        'transactions', 'user_notifications', 'deposits', 'withdrawals',
        'audit_logs', 'admin_logs', 'bug_reports', 'webhook_logs',
        'investments', 'investment_reserve', 'reward_inventory',
        'tutor_requests', 'users_videos', 'voting_votes', 'voting_proposals',
        'governance_votes', 'governance_proposals', 'products'
    ];

    try {
        for (const table of orderedTables) {
            try {
                const res = await client.query(`DELETE FROM ${table}`);
                console.log(`- ${table}: ${res.rowCount} registros removidos.`);
                await client.query(`ALTER SEQUENCE IF EXISTS ${table}_id_seq RESTART WITH 1`);
            } catch (e) {
                // Se a tabela não existir, ignora
            }
        }

        // Limpar usuários e Resetar Josias
        const delUsers = await client.query("DELETE FROM users WHERE id != $1", [ADMIN_ID]);
        console.log(`- Usuários removidos: ${delUsers.rowCount}`);

        await client.query(
            `UPDATE users 
             SET balance = 0, score = 1000, membership_type = 'PRO', is_verified = true,
                 total_borrowed = 0, total_repaid = 0, seller_rating = 5.0, seller_total_sales = 0,
                 seller_total_reviews = 0, last_deposit_at = NULL, security_lock_until = NULL,
                 xp = 0, level = 1
             WHERE id = $1`,
            [ADMIN_ID]
        );

        console.log('\n✅ AMBIENTE 100% LIMPO PARA PRODUÇÃO REAL!');

    } catch (err) {
        console.error('Erro no reset:', err.message);
    } finally {
        await client.end();
    }
}
run();
