
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
    const sqlFile = path.join(__dirname, '../src/infrastructure/database/postgresql/migrations/054_marketplace_food_delivery.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    const client = await pool.connect();
    try {
        console.log('--- EXECUTING FOOD DELIVERY MIGRATION ---');
        await client.query(sql);
        console.log('Migration Applied Successfully!');
    } catch (err) {
        console.error('Error applying migration:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
