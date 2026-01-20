import 'dotenv/config';
import { Pool } from 'pg';

const DB_URL = "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    console.log('🚀 Iniciando migração 046 - Sistema de Proteção Social...');
    try {
        // 1. users
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS protection_expires_at TIMESTAMPTZ;");
        console.log('✅ Colunas em "users" adicionadas!');

        // 2. system_config
        await pool.query("ALTER TABLE system_config ADD COLUMN IF NOT EXISTS mutual_protection_fund DECIMAL(15,2) DEFAULT 0;");
        console.log('✅ Coluna "mutual_protection_fund" em "system_config" adicionada!');

        console.log('🎉 Migração concluída com sucesso!');
    } catch (e: any) {
        console.error('❌ Erro na migração:', e.message);
    } finally {
        await pool.end();
    }
}

runMigration();
