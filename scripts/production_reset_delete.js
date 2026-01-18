
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });
    const ADMIN_ID = 1;

    await client.connect();
    console.log('--- RESET GLOBAL (ESTRATÉGIA DELETE) ---');

    try {
        // 1. Obter todas as tabelas
        const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
        const tables = tablesRes.rows.map(r => r.table_name);

        // 2. Tabelas que NUNCA devem ser limpas completamente ou que requerem cuidado
        const skipTables = ['users', 'system_configs', 'migrations'];

        // 3. Ordem de prioridade para deleção (folhas primeiro)
        const priority = [
            'loan_installments', 'consortium_votes', 'consortium_bids', 'marketplace_order_items',
            'marketplace_reviews', 'marketplace_questions', 'marketplace_favorites',
            'marketplace_listings', 'marketplace_orders', 'marketplace_sellers',
            'consortium_members', 'consortium_withdrawals'
        ];

        tables.sort((a, b) => {
            const aIdx = priority.indexOf(a);
            const bIdx = priority.indexOf(b);
            if (aIdx !== -1 && bIdx !== -1) return bIdx - aIdx;
            if (aIdx !== -1) return -1;
            if (bIdx !== -1) return 1;
            return 0;
        });

        for (const table of tables) {
            if (skipTables.includes(table)) continue;
            try {
                // Tenta deletar tudo da tabela
                const res = await client.query(`DELETE FROM ${table}`);
                if (res.rowCount > 0) console.log(`- ${table}: ${res.rowCount} registros removidos.`);

                // Reiniciar sequências se existirem
                try {
                    await client.query(`ALTER SEQUENCE IF EXISTS ${table}_id_seq RESTART WITH 1`);
                } catch (e) { }
            } catch (e) {
                // console.log(`- ${table}: Falha (${e.message})`);
            }
        }

        // 4. Limpar usuários exceto Josias
        const delUsers = await client.query("DELETE FROM users WHERE id != $1", [ADMIN_ID]);
        console.log(`- Usuários removidos: ${delUsers.rowCount}`);

        // 5. Resetar Josias
        await client.query(
            `UPDATE users 
             SET balance = 0, score = 1000, membership_type = 'PRO', is_verified = true,
                 total_borrowed = 0, total_repaid = 0, seller_rating = 5.0, seller_total_sales = 0,
                 seller_total_reviews = 0, last_deposit_at = NULL, security_lock_until = NULL,
                 xp = 0, level = 1
             WHERE id = $1`,
            [ADMIN_ID]
        );

        console.log('\n✅ AMBIENTE DE PRODUÇÃO PRONTO!');

    } catch (err) {
        console.error('Erro crítico no reset:', err.message);
    } finally {
        await client.end();
    }
}
run();
