
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function fixNotificationsTable() {
    const client = await pool.connect();
    try {
        console.log('Checking notifications table...');

        // Check if table exists
        const tableRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `);

        if (!tableRes.rows[0].exists) {
            console.log('Table "notifications" does not exist. Creating it...');
        } else {
            console.log('Table "notifications" exists. Dropping to recreate with correct schema...');
            await client.query('DROP TABLE notifications CASCADE;');
        }

        // Create table with correct schema (Integer user_id)
        await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'INFO',
        is_read BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
    `);

        console.log('Notifications table created/fixed successfully!');

        // Insert a test notification for the user (assuming user ID 1 or find one)
        const userRes = await client.query('SELECT id FROM users LIMIT 1');
        if (userRes.rows.length > 0) {
            const userId = userRes.rows[0].id;
            await client.query(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES ($1, 'Sistema Funcionando', 'O sistema de notificações foi corrigido e está operante.', 'SUCCESS')
        `, [userId]);
            console.log(`Test notification inserted for user ${userId}`);
        }

    } catch (err) {
        console.error('Error fixing notifications table:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

fixNotificationsTable();
