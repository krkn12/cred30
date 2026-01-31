
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/cred30'
});

async function checkColumns() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY column_name;
    `);
        console.log('Columns found in users table:');
        res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
    } catch (err) {
        console.error('Database Error:', err);
    } finally {
        pool.end();
    }
}

checkColumns();
