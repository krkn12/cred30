const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

console.log('🔌 Connecting to verify tables...\n');
console.log('URL:', process.env.DATABASE_URL.split('@')[1]); // Log safe

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function listTables() {
    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);

        if (res.rows.length === 0) {
            console.log('⚠️  NO TABLES FOUND in public schema.');
        } else {
            console.log('✅ FOUND TABLES:');
            res.rows.forEach(r => console.log(` - ${r.table_name}`));

            // Quick count check on users if it exists
            if (res.rows.some(r => r.table_name === 'users')) {
                const count = await pool.query('SELECT count(*) FROM users');
                console.log(`\n📊 USERS ROW COUNT: ${count.rows[0].count}`);
            }
        }
    } catch (err) {
        console.error('❌ CONNECTION ERROR:', err.message);
    } finally {
        await pool.end();
    }
}

listTables();
