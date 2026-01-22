import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('📊 SALDOS DOS USUÁRIOS:\n');
        const result = await client.query(`SELECT id, name, email, balance FROM users ORDER BY id`);
        for (const u of result.rows) {
            console.log(`${u.id} | ${u.name} | ${u.email} | R$ ${parseFloat(u.balance).toFixed(2)}`);
        }

        console.log('\n📦 STATUS DOS PEDIDOS:\n');
        const orders = await client.query(`
            SELECT o.id, o.status, o.delivery_status, l.title 
            FROM marketplace_orders o 
            JOIN marketplace_listings l ON o.listing_id = l.id 
            ORDER BY o.id
        `);
        for (const o of orders.rows) {
            console.log(`#${o.id} | ${o.status} | ${o.delivery_status} | ${o.title}`);
        }
    } finally {
        client.release();
        await pool.end();
    }
}
run();
