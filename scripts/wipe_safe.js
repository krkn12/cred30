const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function wipeDatabase() {
    console.log("⚠️  INICIANDO LIMPEZA COMPLETA DO BANCO DE DADOS (SAFE MODE) ⚠️");

    // Configuração de conexão igual ao seed_db.js
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("Conectando ao banco de dados...");
        const client = await pool.connect();

        try {
            const tablesToTruncate = [
                'users',
                'system_config',
                'products',
                'rate_limit_logs',
                'admin_logs',
                'marketplace_listings', // Importante limpar explicitamente
                'marketplace_orders',
                'marketplace_favorites',
                'marketplace_questions',
                'marketplace_reviews'
            ];

            console.log(`Truncando tabelas: ${tablesToTruncate.join(', ')}...`);

            await client.query('BEGIN');

            for (const table of tablesToTruncate) {
                // Check if table exists
                const check = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    );
                `, [table]);

                if (check.rows[0].exists) {
                    await client.query(`TRUNCATE TABLE ${table} CASCADE`);
                    console.log(`✅ ${table} limpa (CASCADE)`);
                } else {
                    console.log(`⚠️ Tabela ${table} não existe, pulando.`);
                }
            }

            await client.query('COMMIT');
            console.log("\n✨ BANCO DE DADOS LIMPO COM SUCESSO. ✨");

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("ERRO CRITICO AO LIMPAR DB:", error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

wipeDatabase();
