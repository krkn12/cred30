const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

async function migrate() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cred30'
    });

    try {
        console.log('🚀 Adicionando colunas de GPS na tabela marketplace_orders...');

        await pool.query(`
      ALTER TABLE marketplace_orders 
      ADD COLUMN IF NOT EXISTS courier_lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS courier_lng DOUBLE PRECISION;
    `);

        console.log('✅ Colunas adicionadas com sucesso!');
    } catch (err) {
        console.error('❌ Erro na migração:', err.message);
    } finally {
        await pool.end();
    }
}

migrate();
