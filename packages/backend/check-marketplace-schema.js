const { Client } = require('pg');

const c = new Client('postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
    await c.connect();

    console.log('--- marketplace_listings columns ---');
    const listings = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'marketplace_listings'");
    console.log(listings.rows.map(r => r.column_name).join(', '));

    console.log('\n--- marketplace_orders columns ---');
    const orders = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'marketplace_orders'");
    console.log(orders.rows.map(r => r.column_name).join(', '));

    console.log('\n--- Sample Users ---');
    const users = await c.query("SELECT id, name, email FROM users LIMIT 5");
    users.rows.forEach(u => console.log(`ID: ${u.id}, Name: ${u.name}, Email: ${u.email}`));

    await c.end();
}

main().catch(console.error);
