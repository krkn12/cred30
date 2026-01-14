require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function debugSchema() {
    try {
        console.log('\n=== USERS COLUMNS ===');
        const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
        r.rows.forEach(c => console.log(`${c.column_name}: ${c.data_type}`));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

debugSchema();
