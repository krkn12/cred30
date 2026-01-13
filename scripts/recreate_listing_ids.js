const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function migrate() {
    console.log('--- Migração Radical: Recriando listing_ids ---');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Dropando coluna listing_ids...');
        await pool.query(`ALTER TABLE marketplace_orders DROP COLUMN IF EXISTS listing_ids;`);

        console.log('Criando coluna listing_ids como integer[]...');
        await pool.query(`ALTER TABLE marketplace_orders ADD COLUMN listing_ids integer[];`);

        console.log('✅ Coluna listing_ids recriada com sucesso!');

        // Verificar o novo tipo
        const res = await pool.query(`
            SELECT udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'marketplace_orders' AND column_name = 'listing_ids';
        `);
        console.log('Novo tipo UDT:', res.rows[0]?.udt_name);

    } catch (e) {
        console.error('❌ Erro na migração radical:', e.message);
    } finally {
        await pool.end();
    }
}

migrate();
