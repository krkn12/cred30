const { Pool } = require('pg');

const databaseUrl = 'postgresql://neondb_owner:npg_ODLh9Hdv7eZR@ep-mute-math-ahw4pcdb.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString: databaseUrl,
});

async function migrate() {
    console.log('Starting migration...');
    const client = await pool.connect();
    try {
        const res = await client.query(`
      UPDATE quotas 
      SET current_value = 50.00, purchase_price = 50.00 
      WHERE current_value < 50 AND status = 'ACTIVE'
      RETURNING id
    `);
        console.log(`Updated ${res.rowCount} quotas.`);

        // Revert reserves (simplified logic)
        if (res.rowCount > 0) {
            const totalReversal = 8.00 * res.rowCount;
            await client.query('UPDATE system_config SET investment_reserve = investment_reserve + $1', [totalReversal]);
            console.log(`Reverted R$ ${totalReversal} to investment reserve.`);
        }
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
