
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('--- UPDATING MISSING TARGET_VIEWS ---');
        const res = await client.query(`
        UPDATE promo_videos 
        SET target_views = CAST(budget / price_per_view AS INTEGER);
    `);
        console.log(`Updated ${res.rowCount} videos with calculated target_views.`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
