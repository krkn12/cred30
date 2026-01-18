
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });
    const JOSIAS_ID = 1;

    await client.connect();
    console.log('Conectado para Reset Final.');

    const tablesToClear = [
        'loan_installments', 'loans',
        'consortium_votes', 'consortium_bids', 'consortium_members', 'consortium_withdrawals',
        'marketplace_reviews', 'marketplace_questions', 'marketplace_favorites',
        'marketplace_order_items', 'marketplace_orders', 'marketplace_listings',
        'marketplace_sellers', 'courier_applications', 'couriers',
        'transactions', 'user_notifications', 'deposits', 'withdrawals',
        'audit_logs', 'admin_logs', 'bug_reports'
    ];

    for (const table of tablesToClear) {
        try {
            await client.query(`DELETE FROM ${table} WHERE user_id = $1 OR (CASE WHEN column_name = 'buyer_id' THEN buyer_id = $1 ELSE FALSE END)`, [JOSIAS_ID]);
            // Mais simples: tentar deletar onde houver coluna de user_id
            const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ('user_id', 'buyer_id', 'creator_id', 'reviewer_id')", [table]);
            for (const col of colRes.rows) {
                await client.query(`DELETE FROM ${table} WHERE ${col.column_name} = $1`, [JOSIAS_ID]);
            }
            console.log(`Limpando tabela: ${table} (OK)`);
        } catch (e) {
            // Ignorar se a tabela não existir ou a coluna não bater
        }
    }

    // Reset especial do usuário
    await client.query(
        `UPDATE users 
         SET balance = 0, 
             score = 1000, 
             membership_type = 'PRO', 
             is_verified = true,
             total_borrowed = 0,
             total_repaid = 0,
             seller_total_sales = 0,
             seller_rating = 5.0,
             seller_total_reviews = 0,
             last_deposit_at = NULL,
             security_lock_until = NULL
         WHERE id = $1`,
        [JOSIAS_ID]
    );

    console.log('FINANCEIRO E ATIVIDADE RESETADOS. PERFIL PREMIUM MANTIDO.');
    await client.end();
}
run();
