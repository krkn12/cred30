require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        console.log('--- SYSTEM CONFIG ---');
        const configCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'system_config'");
        console.log('Colunas:', configCols.rows.map(r => r.column_name));

        const configData = await pool.query("SELECT * FROM system_config LIMIT 1");
        console.log('Dados:', configData.rows[0]);

        console.log('\n--- USER (PREÇO POR KM) ---');
        const userData = await pool.query("SELECT id, name, courier_price_per_km FROM users WHERE is_courier = TRUE LIMIT 5");
        console.log('Exemplos de entregadores:', userData.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
