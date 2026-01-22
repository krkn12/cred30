
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fix() {
    console.log('🔧 Corrigindo status dos pedidos para aparecerem no mapa...');
    const client = await pool.connect();
    try {
        const res = await client.query(`
            UPDATE marketplace_orders 
            SET status = 'WAITING_SHIPPING' 
            WHERE status = 'PAID' 
            AND delivery_status = 'AVAILABLE'
        `);
        console.log(`✅ ${res.rowCount} pedidos atualizados de 'PAID' para 'WAITING_SHIPPING'.`);
    } catch (e) {
        console.error('❌ Erro:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

fix();
