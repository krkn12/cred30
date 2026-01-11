const { Client } = require('pg');

const c = new Client('postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
    await c.connect();

    console.log('🔍 Listando últimas 10 ordens...');
    const res = await c.query("SELECT id, status, delivery_status, listing_id FROM marketplace_orders ORDER BY id DESC LIMIT 10");
    console.log('Resultados:', res.rows);

    await c.end();
}

main().catch(console.error);
