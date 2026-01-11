const { Client } = require('pg');

const c = new Client('postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
    await c.connect();

    console.log('📋 Colunas de marketplace_orders:');
    const res = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'marketplace_orders' ORDER BY column_name");
    res.rows.forEach(r => console.log(`  - ${r.column_name}`));

    await c.end();
}

main().catch(console.error);
