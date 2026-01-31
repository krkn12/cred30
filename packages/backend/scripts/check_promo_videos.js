
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkPromoVideos() {
    const client = await pool.connect();
    try {
        console.log('Checking promo_videos table...');

        const res = await client.query(`
        SELECT id, user_id, title, status, is_active, created_at 
        FROM promo_videos 
        ORDER BY created_at DESC
    `);

        if (res.rows.length === 0) {
            console.log('No promo videos found in the database.');
        } else {
            console.log('Found promo videos:');
            console.table(res.rows);
        }

        // Check if table exists properly?
        // (Assuming it does since we didn't get 500 error on create)

    } catch (err) {
        console.error('Error checking promo videos:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

checkPromoVideos();
