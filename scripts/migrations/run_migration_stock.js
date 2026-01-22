const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🚀 Executando migration: Adicionando coluna stock...');

        await pool.query(`
            ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 1;
        `);

        console.log('✅ Coluna stock adicionada com sucesso!');

    } catch (error) {
        console.error('❌ Erro na migration:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
