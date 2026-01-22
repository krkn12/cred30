import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    console.log('🚀 Iniciando migration 042...');
    const migrationPath = path.join(__dirname, '../src/infrastructure/database/postgresql/migrations/042_consortium_pool.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    try {
        await pool.query(sql);
        console.log('✅ Migration 042 executada com sucesso!');
    } catch (error: any) {
        console.error('❌ Erro na migration:', error.message);
    } finally {
        await pool.end();
    }
}

runMigration().catch(console.error);
