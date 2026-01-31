
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
        console.log('--- SYNCING VIEW COUNTERS ---');

        // 1. Get current stats
        const stats = await client.query(`
        SELECT 
            pv.id, pv.title, pv.total_views as counter_views,
            (SELECT COUNT(*) FROM promo_video_views WHERE video_id = pv.id) as real_views
        FROM promo_videos pv
    `);
        console.table(stats.rows);

        // 2. Update counter to match real rows
        const res = await client.query(`
        UPDATE promo_videos pv
        SET total_views = (SELECT COUNT(*) FROM promo_video_views WHERE video_id = pv.id)
    `);

        console.log(`Synced ${res.rowCount} videos. Counters now match real rows.`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
