const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'marketplace_listings' AND column_name = 'id'");
    console.log(res.rows[0]);
    await pool.end();
}
run();
