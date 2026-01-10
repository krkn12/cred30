import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
console.log('CWD:', process.cwd());
console.log('DATABASE_URL defined:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
    console.log('DATABASE_URL starts with:', process.env.DATABASE_URL.substring(0, 20));
}
import { pool } from '../src/infrastructure/database/postgresql/connection/pool';

async function runMigration() {
    console.log('Iniciando migração de segurança...');
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
        await client.query('ROLLBACK');
        console.error('Erro na migração:', err);
    } finally {
        client.release();
        process.exit();
    }
}

runMigration();
