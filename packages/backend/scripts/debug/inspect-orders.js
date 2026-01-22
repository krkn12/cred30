const { Client } = require('pg');

const c = new Client('postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
    await c.connect();

    console.log('--- Columns for marketplace_orders ---');
    const res = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'marketplace_orders'");
    res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

    console.log('\n--- Status Counts ---');
    const stats = await c.query("SELECT status, delivery_status, COUNT(*) FROM marketplace_orders GROUP BY status, delivery_status");
    stats.rows.forEach(r => console.log(`Status: ${r.status}, Delivery: ${r.delivery_status}, Count: ${r.count}`));

    await c.end();
}

main().catch(console.error);
