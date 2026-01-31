
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken'); // Assuming it's installed
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Use native fetch (Node 18+)
const fetch = global.fetch;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const API_URL = 'http://localhost:3001/api';

async function runSimulation() {
    const client = await pool.connect();
    let viewerId = null;

    try {
        console.log('--- STARTING PROMO VIDEO SIMULATION ---');

        // 1. Find or Create a Viewer User (NOT the owner of the video)
        // We know previous script inserted video for User ID 2 (Josias)
        // We need a different user.
        const viewerRes = await client.query(`
        SELECT id, name, email FROM users 
        WHERE id != 2 AND status = 'ACTIVE' 
        LIMIT 1
    `);

        if (viewerRes.rows.length === 0) {
            console.log('No suitable viewer found. Creating a DUMMY viewer...');
            const randomSuffix = Date.now();
            // Create dummy user
            const createRes = await client.query(`
                INSERT INTO users (name, email, cpf, password_hash, role, status)
                VALUES ($1, $2, $3, $4, 'USER', 'ACTIVE')
                RETURNING id, name, email
            `, [
                `Test Viewer ${randomSuffix}`,
                `viewer${randomSuffix}@test.com`,
                `000${randomSuffix.toString().slice(-8)}`, // Fake CPF
                '$2b$10$EpOd.z.d.z.d.z.d.z.d.z.d.z.d.z.d.z.d.z.d.z.d.z.d.z.d', // Dummy hash
            ]);
            viewerRes.rows = [createRes.rows[0]];
            console.log(`Dummy Viewer Created: ${createRes.rows[0].name} (ID: ${createRes.rows[0].id})`);
        }
        const viewer = viewerRes.rows[0];
        viewerId = viewer.id;
        console.log(`Viewer Selected: ${viewer.name} (ID: ${viewer.id})`);

        // 2. Generate JWT for Viewer
        const token = jwt.sign(
            { userId: viewer.id, email: viewer.email, role: 'USER' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        console.log('JWT Token Generated.');

        // Create view cleanup
        await client.query('DELETE FROM promo_video_views WHERE viewer_id = $1', [viewerId]);
        console.log('Cleaned up previous views for viewer.');

        // 3. Get Feed via API
        console.log('Fetching Feed...');
        const feedRes = await fetch(`${API_URL}/promo-videos/feed`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const feedData = await feedRes.json();

        if (!feedData.success || feedData.data.length === 0) {
            console.error('Feed is empty or failed!', feedData);
            process.exit(1);
        }

        // Find our test video (ID 1 ideally, or the one we inserted)
        // Looking for title "TESTE DE SUPORTE - NÃO APAGAR"
        const targetVideo = feedData.data.find(v => v.title === "TESTE DE SUPORTE - NÃO APAGAR");

        if (!targetVideo) {
            console.error('Target video not found in feed!', feedData.data.map(v => v.title));
            process.exit(1);
        }
        const videoId = targetVideo.id;
        console.log(`Found Target Video: "${targetVideo.title}" (ID: ${videoId})`);
        console.log('Video Data in Feed:', JSON.stringify(targetVideo, null, 2));

        // Only proceed if not already watched
        // The feed usually filters out watched videos. Since it appeared, we assume not watched.

        // 4. Start View (POST /:id/start-view)
        console.log('Starting View...');
        const startRes = await fetch(`${API_URL}/promo-videos/${videoId}/start-view`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ deviceFingerprint: `sim_dev_${Date.now()}` })
        });

        const startData = await startRes.json();
        if (!startData.success) {
            console.error('Start View Failed:', startData);
            process.exit(1);
        }
        console.log('View Started successfully.', startData.data);

        // 5. Simulate Watch Time (Sleep slightly less than minWatchSeconds to test speed check? Or just partial?)
        // Controller logic: 
        // if (elapsedSeconds < (view.min_watch_seconds - 2)) fail.
        // We will simulate "Success" so we don't sleep for real 20s, that's too slow.
        // Wait, the controller checks `started_at` in DB vs `now`.

        // We can "cheat" by backdating the `started_at` in DB so we don't have to wait.
        console.log('>> Backdating view start time to bypass wait...');
        await client.query(`
        UPDATE promo_video_views 
        SET started_at = NOW() - INTERVAL '30 seconds' 
        WHERE id = $1
    `, [startData.data.viewId]);

        // 6. Complete View (POST /:id/complete-view)
        console.log('Completing View...');
        const completeRes = await fetch(`${API_URL}/promo-videos/${videoId}/complete-view`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                watchTimeSeconds: 30,
                missionsCompleted: [],
                isBot: false
            })
        });

        const completeData = await completeRes.json();
        if (!completeData.success) {
            console.error('Complete View Failed:', completeData);
        } else {
            console.log('✓ View Completed! Reward:', completeData.message);
        }

        // 7. Verification Audit
        console.log('--- AUDIT RESULTS ---');

        // Check View Record
        const viewCheck = await client.query('SELECT completed, earned FROM promo_video_views WHERE id = $1', [startData.data.viewId]);
        console.log('View DB Status:', viewCheck.rows[0]);

        // Check Video Stats
        const videoCheck = await client.query('SELECT total_views, spent, budget FROM promo_videos WHERE id = $1', [videoId]);
        console.log('Video stats:', videoCheck.rows[0]);

        // Check User Points
        const userCheck = await client.query('SELECT ad_points, total_ad_points FROM users WHERE id = $1', [viewerId]);
        console.log(`Viewer (ID ${viewerId}) Points:`, userCheck.rows[0]);

    } catch (err) {
        console.error('Simulation Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

runSimulation();
