const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query(`
            SELECT udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'marketplace_orders' AND column_name = 'listing_ids';
        `);
        console.log('Tipo UDT:', res.rows[0]?.udt_name);
    } catch (e) { console.error(e); }
    await pool.end();
}
run();
