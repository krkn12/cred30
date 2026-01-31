import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Carregar .env do backend
dotenv.config({ path: path.join(process.cwd(), 'packages', 'backend', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const migrationPath = path.join(__dirname, '..', 'src', 'infrastructure', 'database', 'postgresql', 'migrations', '055_delivery_premium_enhancements.sql');

    if (!fs.existsSync(migrationPath)) {
        console.error('Migration file not found:', migrationPath);
        process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Aplicando migração 055...');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migração 055 aplicada com sucesso!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao aplicar migração:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
