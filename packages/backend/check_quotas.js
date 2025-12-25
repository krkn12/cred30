require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkQuotas() {
    try {
        // Check quota columns
        const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'quotas'
    `);
        console.log('Quota columns:', cols.rows);

        // Check recent quotas
        const quotas = await pool.query(`
      SELECT id, user_id, status FROM quotas 
      WHERE user_id = 2 AND status = 'ACTIVE'
      LIMIT 5
    `);
        console.log('Active quotas for user 2:', quotas.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkQuotas();
