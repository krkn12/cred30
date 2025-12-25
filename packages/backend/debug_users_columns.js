require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkColumns() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
        console.log('Columns in users table:', res.rows);
    } catch (err) {
        console.error('Error querying columns:', err);
    } finally {
        await pool.end();
    }
}

checkColumns();
