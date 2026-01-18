
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
    const ADMIN_ID = 1; // Josias

    try {
        await client.connect();
        console.log('--- RESET GLOBAL PARA PRODUÇÃO (LIMPEZA TOTAL) ---');

        // Tabelas a serem TRUNCADAS completamente (independente de usuário)
        const tablesToTruncate = [
            'transactions', 'loans', 'loan_installments', 'quotas', 'quota_sales',
            'consortium_votes', 'consortium_bids', 'consortium_assemblies', 'consortium_groups',
            'consortium_members', 'consortium_withdrawals', 'marketplace_order_items',
            'marketplace_orders', 'marketplace_listings', 'marketplace_sellers',
            'marketplace_reviews', 'marketplace_questions', 'marketplace_favorites',
            'marketplace_coupons', 'courier_applications', 'couriers', 'admin_logs',
            'audit_logs', 'bug_reports', 'webhook_logs', 'user_notifications',
            'deposits', 'withdrawals', 'investments', 'investment_reserve',
            'reward_inventory', 'tutor_requests', 'users_videos', 'voting_votes',
            'voting_proposals', 'governance_votes', 'governance_proposals', 'products'
        ];

        console.log('Executando limpeza profunda (TRUNCATE CASCADE)...');
        try {
            // Executar em um único comando para evitar problemas de FK interligadas
            await client.query(`TRUNCATE TABLE ${tablesToTruncate.join(', ')} RESTART IDENTITY CASCADE`);
            console.log('✅ Todas as tabelas transacionais foram zeradas.');
        } catch (e) {
            console.error('Erro no TRUNCATE global:', e.message);
            // Fallback: tentar um por um se falhar o global
            for (const table of tablesToTruncate) {
                try {
                    await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
                    console.log(`- ${table}: Limpa.`);
                } catch (err) { }
            }
        }

        // 2. Deletar todos os usuários EXCETO o Josias (Admin)
        console.log('Removendo usuários experimentais...');
        const deleteUsersRes = await client.query("DELETE FROM users WHERE id != $1", [ADMIN_ID]);
        console.log(`- Usuários removidos: ${deleteUsersRes.rowCount}`);

        // 3. Resetar o estado do Josias para o "Dia 0" de produção
        console.log('Resetando perfil administrativo (Josias)...');
        await client.query(
            `UPDATE users 
             SET balance = 0, 
                 score = 1000, 
                 membership_type = 'PRO', 
                 is_verified = true,
                 total_borrowed = 0,
                 total_repaid = 0,
                 seller_rating = 5.0,
                 seller_total_sales = 0,
                 seller_total_reviews = 0,
                 last_deposit_at = NULL,
                 security_lock_until = NULL,
                 xp = 0,
                 level = 1,
                 referral_code = 'ADMIN' || floor(random() * 1000) -- Gerar um código novo básico
             WHERE id = $1`,
            [ADMIN_ID]
        );

        // 4. Limpar Balanço do Sistema / Reservas (Se houver tabela de resumo)
        // Por exemplo, na tabela system_configs ou algo similar se existir
        try {
            await client.query("UPDATE system_configs SET value = '0' WHERE key ILIKE '%liquidity%' OR key ILIKE '%reserve%'");
            console.log('- Configurações de liquidez resetadas.');
        } catch (e) { }

        console.log('\n✅ SISTEMA ZERADO E PRONTO PARA PRODUÇÃO!');
        console.log('Nota: Apenas o usuário Josias (ID 1) foi preservado com status PRO.');

    } catch (err) {
        console.error('Erro crítico no reset global:', err.message);
    } finally {
        await client.end();
    }
}

run();
