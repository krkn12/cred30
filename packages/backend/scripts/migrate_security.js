
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
    console.log('Iniciando migração de segurança (JS)...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'DEFINED' : 'UNDEFINED');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('- Adicionando coluna last_deposit_at em users...');
        await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_deposit_at TIMESTAMP WITH TIME ZONE;');
        console.log('- Adicionando coluna is_under_duress se não existir...');
        await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_under_duress BOOLEAN DEFAULT FALSE;');
        console.log('- Adicionando coluna security_lock_until se não existir...');
        await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS security_lock_until TIMESTAMP WITH TIME ZONE;');
        await client.query('COMMIT');
        console.log('Migração concluída com sucesso!');
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Erro na migração:', err);
    } finally {
        if (client) client.release();
        pool.end();
    }
}

runMigration();
