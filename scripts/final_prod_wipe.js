
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });
    const ADMIN_ID = 1;

    await client.connect();
    console.log('--- LIMPANDO TUDO PARA PRODUÇÃO REAL ---');

    try {
        // 1. Obter todas as tabelas
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
        const tables = res.rows.map(r => r.table_name);

        const skipTables = ['users', 'migrations', 'system_configs'];

        // Desabilitar triggers (inclusive FKs) para limpeza bruta e rápida
        await client.query("SET session_replication_role = 'replica'");

        for (const table of tables) {
            if (skipTables.includes(table)) continue;
            try {
                await client.query(`DELETE FROM ${table}`);
                await client.query(`ALTER SEQUENCE IF EXISTS ${table}_id_seq RESTART WITH 1`);
                console.log(`- ${table}: Zerada.`);
            } catch (e) {
                console.log(`- ${table}: Erro (${e.message})`);
            }
        }

        // 2. Limpar usuários e Resetar Josias
        await client.query("DELETE FROM users WHERE id != $1", [ADMIN_ID]);
        await client.query(
            `UPDATE users 
             SET balance = 0, score = 1000, membership_type = 'PRO', is_verified = true,
                 total_borrowed = 0, total_repaid = 0, seller_rating = 5.0, seller_total_sales = 0,
                 seller_total_reviews = 0, last_deposit_at = NULL, security_lock_until = NULL,
                 xp = 0, level = 1
             WHERE id = $1`,
            [ADMIN_ID]
        );

        // Reabilitar triggers
        await client.query("SET session_replication_role = 'origin'");

        console.log('\n--- 🚀 SISTEMA EM PRODUÇÃO REAL! (DATABASE ZERO) ---');

    } catch (err) {
        console.error('Erro no reset final:', err.message);
    } finally {
        await client.end();
    }
}
run();
