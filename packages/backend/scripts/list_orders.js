const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
    await client.connect();

    console.log('=== ENTREGAS EXISTENTES ===');
    const res = await client.query(`
        SELECT id, status, delivery_status, pickup_address, delivery_address, created_at 
        FROM marketplace_orders 
        ORDER BY created_at DESC 
        LIMIT 10
    `);

    res.rows.forEach(r => {
        console.log(`ID: ${r.id} | Status: ${r.status} | Delivery: ${r.delivery_status} | Criado: ${r.created_at}`);
    });

    await client.end();
}

run().catch(console.error);
