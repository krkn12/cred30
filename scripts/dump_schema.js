const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });
const fs = require('fs');

async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'marketplace_orders'
        ORDER BY ordinal_position;
    `);

    const output = res.rows.map(row => `${row.column_name}: ${row.data_type}`).join('\n');
    fs.writeFileSync('schema_diag.txt', output);
    console.log('Schema salvo em schema_diag.txt');
    await pool.end();
}
run();
