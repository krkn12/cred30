
const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkRewards() {
    try {
        const res = await pool.query('SELECT id, name, image_url, is_active FROM reward_catalog');
        console.log('--- Rewards in DB ---');
        console.table(res.rows.map(r => ({
            id: r.id,
            name: r.name,
            active: r.is_active,
            image_url: r.image_url ? (r.image_url.length > 50 ? r.image_url.substring(0, 47) + '...' : r.image_url) : 'NULL'
        })));
    } catch (err) {
        console.error('Error querying DB:', err);
    } finally {
        await pool.end();
    }
}

checkRewards();
