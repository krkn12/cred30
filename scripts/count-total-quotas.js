require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        const res = await pool.query("SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE' OR status IS NULL");
        console.log('Total Quotas no Sistema:', res.rows[0].count);

        const config = await pool.query("SELECT profit_pool FROM system_config LIMIT 1");
        console.log('Lucro Acumulado (Profit Pool):', config.rows[0].profit_pool);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
