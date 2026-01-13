const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function dumpSchema() {
    try {
        console.log('--- ESTRUTURA DETALHADA DO BANCO DE DADOS ---');

        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);

        for (const row of tables.rows) {
            const tableName = row.table_name;
            const columns = await pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = $1
                ORDER BY ordinal_position
            `, [tableName]);

            console.log(`\nTABLE: ${tableName}`);
            console.table(columns.rows);
        }

    } catch (e) {
        console.error('ERRO NO DUMP:', e.message);
    } finally {
        await pool.end();
    }
}
dumpSchema();
