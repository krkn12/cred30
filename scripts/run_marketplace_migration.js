require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('🚀 Executando migration 030_marketplace_enhancements...\n');

        const sql = fs.readFileSync(
            'packages/backend/src/infrastructure/database/postgresql/migrations/030_marketplace_enhancements.sql',
            'utf8'
        );

        // Executar cada statement separadamente
        const statements = sql.split(';').filter(s => s.trim());

        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await pool.query(statement);
                    const firstLine = statement.trim().split('\n')[0].substring(0, 60);
                    console.log(`✅ ${firstLine}...`);
                } catch (err) {
                    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
                        console.log(`⏭️ Já existe: ${statement.trim().split('\n')[0].substring(0, 50)}...`);
                    } else {
                        console.error(`❌ Erro: ${err.message}`);
                    }
                }
            }
        }

        console.log('\n✅ Migration concluída com sucesso!');

    } catch (error) {
        console.error('❌ Erro fatal:', error.message);
    } finally {
        await pool.end();
    }
}

runMigration();
