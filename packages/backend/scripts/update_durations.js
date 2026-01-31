
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('--- UPDATING NULL DURATIONS ---');
        const res = await client.query(`
        UPDATE promo_videos 
        SET duration_seconds = 60 
        WHERE duration_seconds IS NULL
    `);
        console.log(`Updated ${res.rowCount} videos.`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
