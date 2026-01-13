const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function diagnose() {
    console.log('--- Diagnóstico Detalhado (Marketplace) ---');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const tables = ['marketplace_orders', 'marketplace_listings', 'users'];
        for (const table of tables) {
            console.log(`\n--- Tabela: ${table} ---`);
            const res = await pool.query(`
                SELECT column_name, data_type, character_maximum_length, is_nullable
                FROM information_schema.columns 
                WHERE table_name = $1
                ORDER BY ordinal_position;
            `, [table]);

            res.rows.forEach(row => {
                console.log(`${row.column_name.padEnd(25)} | ${row.data_type.padEnd(20)} | Nullable: ${row.is_nullable}`);
            });
        }
    } catch (e) {
        console.error('Erro no diagnóstico:', e);
    } finally {
        await pool.end();
    }
}

diagnose();
