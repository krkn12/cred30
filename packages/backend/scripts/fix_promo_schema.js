
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
        console.log('--- FIXING PROMO VIDEOS SCHEMA ---');

        console.log('Adding missing columns to promo_videos...');
        await client.query(`
      ALTER TABLE promo_videos 
      ADD COLUMN IF NOT EXISTS require_like BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS require_comment BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS require_subscribe BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS min_score_required INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS verified_only BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS external_initial_likes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS external_current_likes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS external_initial_comments INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS external_current_comments INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS external_initial_subscribers INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS external_current_subscribers INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS audit_health_score INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS last_audit_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS budget_gross DECIMAL(10,2) DEFAULT 0;
    `);

        console.log('Adding missing columns to promo_video_views...');
        await client.query(`
      ALTER TABLE promo_video_views 
      ADD COLUMN IF NOT EXISTS liked BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS commented BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS subscribed BOOLEAN DEFAULT FALSE;
    `);

        console.log('Schema updated successfully!');

    } catch (err) {
        console.error('Error fixing schema:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
