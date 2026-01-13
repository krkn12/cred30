const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function diagnose() {
    console.log('--- Diagnóstico marketplace_orders ---');
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

        console.log('TOTAL COLUNAS:', res.rows.length);
        res.rows.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type}`);
        });
    } catch (e) {
        console.error('Erro:', e);
    } finally {
        await pool.end();
    }
}

diagnose();
