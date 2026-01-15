import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

async function runFullMigration() {
    console.log('🚀 Iniciando reformulação das tabelas de consórcio...');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Drop existing consortium tables to avoid type conflicts
        console.log('🗑️ Removendo tabelas antigas (se existirem)...');
        await client.query(`
            DROP TABLE IF EXISTS consortium_votes CASCADE;
            DROP TABLE IF EXISTS consortium_bids CASCADE;
            DROP TABLE IF EXISTS consortium_assemblies CASCADE;
            DROP TABLE IF EXISTS consortium_members CASCADE;
            DROP TABLE IF EXISTS consortium_groups CASCADE;
        `);

        // Run Migration 041 (Corrected logic)
        console.log('📜 Executando Migration 041 (Schema Base)...');
        const sql041 = fs.readFileSync(path.join(__dirname, '../src/infrastructure/database/postgresql/migrations/041_consortium_system.sql'), 'utf8');
        await client.query(sql041);

        // Run Migration 042 (Pool & Payments)
        console.log('📜 Executando Migration 042 (Pool & Pagamentos)...');
        const sql042 = fs.readFileSync(path.join(__dirname, '../src/infrastructure/database/postgresql/migrations/042_consortium_pool.sql'), 'utf8');
        await client.query(sql042);

        await client.query('COMMIT');
        console.log('✅ Todas as migrations do consórcio executadas com sucesso!');
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('❌ Erro nas migrations:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

runFullMigration().catch(console.error);
