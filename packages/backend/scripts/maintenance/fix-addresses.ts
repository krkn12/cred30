
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fix() {
    console.log('🔧 Preenchendo endereços que faltam...');
    const client = await pool.connect();
    try {
        // Endereços genéricos de Belém para teste
        const res1 = await client.query(`
            UPDATE marketplace_orders 
            SET pickup_address = 'Ver-o-Peso, Blvd. Castilhos França - Comércio, Belém - PA',
                delivery_address = 'Av. Visconde de Souza Franco (Doca), Reduto, Belém - PA'
            WHERE pickup_address IS NULL OR delivery_address IS NULL
        `);
        console.log(`✅ ${res1.rowCount} pedidos atualizados com endereços de teste de Belém.`);
    } catch (e) {
        console.error('❌ Erro:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

fix();
