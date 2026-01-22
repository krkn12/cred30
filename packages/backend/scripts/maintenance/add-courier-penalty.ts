
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('🔧 Adicionando coluna de penalidade ao entregador...');
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_penalty_until TIMESTAMP WITH TIME ZONE`);
        console.log('✅ Coluna courier_penalty_until adicionada a tabela users.');
    } catch (e) {
        console.error('❌ Erro:', e);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
