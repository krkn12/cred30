import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        // Listar tabelas
        const tables = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' ORDER BY table_name
        `);
        console.log('📋 TABELAS NO BANCO:');
        for (const t of tables.rows) {
            console.log(`   - ${t.table_name}`);
        }
    } finally {
        client.release();
        await pool.end();
    }
}
run();
