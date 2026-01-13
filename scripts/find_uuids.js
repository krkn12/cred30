const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const res = await pool.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE data_type = 'uuid' AND table_name LIKE 'marketplace_%';
    `);

    console.table(res.rows);
    await pool.end();
}
run();
