const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });
const fs = require('fs');
const path = require('path');

async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const res = await pool.query(`
        SELECT column_name, data_type, ordinal_position
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position;
    `);

    const output = res.rows.map(row => `${row.ordinal_position.toString().padStart(2, ' ')} | ${row.column_name.padEnd(25)} | ${row.data_type}`).join('\n');
    const filePath = path.join(__dirname, 'users_schema.txt');
    fs.writeFileSync(filePath, output);
    console.log('Schema salvo em:', filePath);
    await pool.end();
}
run();
