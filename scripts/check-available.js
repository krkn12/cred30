require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const res = await pool.query("SELECT id, seller_id, buyer_id, delivery_status, pickup_lat, pickup_lng FROM marketplace_orders WHERE delivery_status = 'AVAILABLE'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
