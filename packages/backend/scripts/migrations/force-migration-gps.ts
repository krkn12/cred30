
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    console.log('🔧 Aplicando colunas GPS...');
    const client = await pool.connect();
    try {
        await client.query(`ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10, 8);`);
        await client.query(`ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_lng DECIMAL(11, 8);`);
        await client.query(`ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_lat DECIMAL(10, 8);`);
        await client.query(`ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_lng DECIMAL(11, 8);`);
        console.log('✅ Colunas GPS garantidas.');
    } catch (e) {
        console.error('❌ Erro migração:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
