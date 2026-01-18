
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });
    const ADMIN_ID = 1;

    await client.connect();
    console.log('--- RESET DINÂMICO DE PRODUÇÃO ---');

    try {
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
        const tables = res.rows.map(r => r.table_name);

        const skip = ['users', 'migrations', 'system_configs', 'system_config'];

        // Loop de limpeza em camadas (tenta deletar tudo várias vezes para bater as FKs)
        let totalDeleted = 1;
        let pass = 1;
        while (totalDeleted > 0 && pass <= 5) {
            totalDeleted = 0;
            console.log(`Passagem de limpeza #${pass}...`);
            for (const table of tables) {
                if (skip.includes(table)) continue;
                try {
                    const del = await client.query(`DELETE FROM ${table}`);
                    if (del.rowCount > 0) {
                        console.log(`- ${table}: ${del.rowCount} removidos.`);
                        totalDeleted += del.rowCount;
                        await client.query(`ALTER SEQUENCE IF EXISTS ${table}_id_seq RESTART WITH 1`);
                    }
                } catch (e) {
                    // Esperado se houver dependência, tentará na próxima passagem
                }
            }
            pass++;
        }

        // Finalizar com usuários
        const users = await client.query("DELETE FROM users WHERE id != $1", [ADMIN_ID]);
        console.log(`- Usuários experimentais removidos: ${users.rowCount}`);

        // Reset administrativo
        await client.query(`
            UPDATE users SET 
                balance = 0, score = 1000, membership_type = 'PRO', is_verified = true,
                total_borrowed = 0, total_repaid = 0, seller_rating = 5.0, 
                seller_total_sales = 0, seller_total_reviews = 0, last_deposit_at = NULL,
                xp = 0, level = 1
            WHERE id = $1
        `, [ADMIN_ID]);

        console.log('\n✅ AMBIENTE PRONTO: PRODUÇÃO ATIVA (ZERO KM).');

    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        await client.end();
    }
}
run();
