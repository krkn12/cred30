
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    let dbUrl;
    try {
        const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
        const match = envContent.match(/DATABASE_URL=(.+)/);
        if (!match) throw new Error('DATABASE_URL não encontrada no .env');
        dbUrl = match[1].trim();
    } catch (e) {
        console.error('Erro ao ler .env:', e.message);
        process.exit(1);
    }

    const client = new Client({ connectionString: dbUrl });
    const JOSIAS_ID = 1;

    try {
        await client.connect();
        console.log('Conectado ao NeonDB para Reset do Josias.');

        // Deletar em ordem de dependência (FKs)
        console.log('Limpando histórico de atividades...');

        // Marketplace
        await client.query("DELETE FROM marketplace_order_items WHERE order_id IN (SELECT id FROM marketplace_orders WHERE buyer_id = $1)", [JOSIAS_ID]);
        await client.query("DELETE FROM marketplace_orders WHERE buyer_id = $1 OR seller_id IN (SELECT id FROM marketplace_sellers WHERE user_id = $1)", [JOSIAS_ID]);
        await client.query("DELETE FROM marketplace_listings WHERE seller_id IN (SELECT id FROM marketplace_sellers WHERE user_id = $1)", [JOSIAS_ID]);

        // Consórcio
        await client.query("DELETE FROM consortium_votes WHERE voter_id = $1", [JOSIAS_ID]);
        await client.query("DELETE FROM consortium_bids WHERE member_id IN (SELECT id FROM consortium_members WHERE user_id = $1)", [JOSIAS_ID]);
        await client.query("DELETE FROM consortium_members WHERE user_id = $1", [JOSIAS_ID]);

        // Empréstimos
        await client.query("DELETE FROM loan_installments WHERE loan_id IN (SELECT id FROM loans WHERE user_id = $1)", [JOSIAS_ID]);
        await client.query("DELETE FROM loans WHERE user_id = $1", [JOSIAS_ID]);

        // Geral
        await client.query("DELETE FROM transactions WHERE user_id = $1", [JOSIAS_ID]);
        await client.query("DELETE FROM user_notifications WHERE user_id = $1", [JOSIAS_ID]);

        // Reset do perfil mantendo privilégios
        console.log('Resetando balanço e configurando perfil premium...');
        await client.query(
            `UPDATE users 
             SET balance = 0, 
                 score = 1000, 
                 membership_type = 'PRO', 
                 is_verified = true,
                 total_borrowed = 0,
                 total_repaid = 0,
                 last_deposit_at = NULL,
                 security_lock_until = NULL
             WHERE id = $1`,
            [JOSIAS_ID]
        );

        console.log('✅ Josias: Dados limpos. Perfil PRO/Verificado/1000 Score pronto para início do zero.');

    } catch (err) {
        console.error('Erro na execução:', err.message);
    } finally {
        await client.end();
    }
}

run();
