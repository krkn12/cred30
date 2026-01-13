const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function migrate() {
    console.log('--- Migração: Estoque e Endereços Profissionais ---');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // marketplace_listings
        console.log('Atualizando marketplace_listings...');
        await pool.query(`
            ALTER TABLE marketplace_listings 
            ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS pickup_address TEXT;
        `);

        // marketplace_orders
        console.log('Atualizando marketplace_orders...');
        await pool.query(`
            ALTER TABLE marketplace_orders 
            ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
        `);

        console.log('✅ Migração concluída com sucesso!');
    } catch (e) {
        console.error('❌ Erro na migração:', e.message);
    } finally {
        await pool.end();
    }
}

migrate();
