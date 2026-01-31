
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
        // 1. Get a user
        const userRes = await client.query('SELECT id, name, email FROM users LIMIT 1');
        if (userRes.rows.length === 0) {
            console.log('No users found to assign video to.');
            return;
        }
        const user = userRes.rows[0];
        console.log(`Found User: ${user.name} (ID: ${user.id})`);

        // 2. Insert Test Video
        const videoData = {
            userId: user.id,
            title: 'TESTE DE SUPORTE - NÃO APAGAR',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            budget: 10.00
        };

        console.log('Inserting test video...');
        const insertRes = await client.query(`
        INSERT INTO promo_videos (
            user_id, title, description, video_url, platform, 
            price_per_view, min_watch_seconds, budget, spent, 
            status, is_active, is_approved, created_at
        ) VALUES (
            $1, $2, 'Video de teste inserido via script', $3, 'YOUTUBE',
            0.10, 20, $4, 0,
            'ACTIVE', TRUE, TRUE, NOW()
        ) RETURNING id;
    `, [videoData.userId, videoData.title, videoData.videoUrl, videoData.budget]);

        console.log(`Test Video Inserted! ID: ${insertRes.rows[0].id}`);
        console.log('Please ask the user to refresh "My Campaigns" or "Feed".');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
