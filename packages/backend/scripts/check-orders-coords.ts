import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('🔍 Verificando coordenadas dos pedidos...\n');

        const result = await client.query(`
            SELECT id, status, delivery_status, 
                   pickup_address, pickup_lat, pickup_lng,
                   delivery_address, delivery_lat, delivery_lng
            FROM marketplace_orders
            ORDER BY id DESC
            LIMIT 10
        `);

        for (const row of result.rows) {
            console.log(`📦 Pedido #${row.id}`);
            console.log(`   Status: ${row.status} | Delivery Status: ${row.delivery_status}`);
            console.log(`   Pickup: ${row.pickup_address}`);
            console.log(`   Pickup Coords: ${row.pickup_lat}, ${row.pickup_lng}`);
            console.log(`   Delivery: ${row.delivery_address}`);
            console.log(`   Delivery Coords: ${row.delivery_lat}, ${row.delivery_lng}`);
            console.log('---');
        }

    } catch (e) {
        console.error('❌ Erro:', e);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
