const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const res = await pool.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'marketplace_orders' AND column_name = 'listing_id'");
    console.log(res.rows[0]);
    await pool.end();
}
run();
