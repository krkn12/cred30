const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function diagnose() {
    console.log('--- Diagnóstico de Tipos de Coluna (Marketplace) ---');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'marketplace_orders'
            ORDER BY ordinal_position;
        `);
        console.table(res.rows);

        const resListings = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'marketplace_listings'
            ORDER BY ordinal_position;
        `);
        console.log('\n--- marketplace_listings table ---');
        console.table(resListings.rows);

    } catch (e) {
        console.error('Erro no diagnóstico:', e);
    } finally {
        await pool.end();
    }
}

diagnose();
