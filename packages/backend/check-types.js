const { Client } = require('pg');

const c = new Client('postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
    await c.connect();

    console.log('📋 Tipos de dados em marketplace_orders:');
    const res = await c.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'marketplace_orders' 
        AND column_name IN ('buyer_id', 'seller_id', 'listing_id')
    `);
    res.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

    console.log('\n📋 Tipos de dados em users:');
    const res2 = await c.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'id'
    `);
    res2.rows.forEach(r => console.log(`  - id: ${r.data_type}`));

    await c.end();
}

main().catch(console.error);
