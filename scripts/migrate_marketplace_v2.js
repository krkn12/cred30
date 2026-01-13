const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function migrate() {
    console.log('--- Iniciando Migração de Banco de Dados (Marketplace Hotfix) ---');
    console.log('Conectando ao banco...');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Adicionando colunas em system_config...');
        await client.query(`
            ALTER TABLE system_config 
            ADD COLUMN IF NOT EXISTS courier_price_per_km DECIMAL(10,2) DEFAULT 2.50
        `);

        console.log('Adicionando colunas em marketplace_orders...');
        await client.query(`
            ALTER TABLE marketplace_orders 
            ADD COLUMN IF NOT EXISTS listing_ids INTEGER[],
            ADD COLUMN IF NOT EXISTS is_lote BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10, 8),
            ADD COLUMN IF NOT EXISTS pickup_lng DECIMAL(11, 8),
            ADD COLUMN IF NOT EXISTS delivery_lat DECIMAL(10, 8),
            ADD COLUMN IF NOT EXISTS delivery_lng DECIMAL(11, 8),
            ADD COLUMN IF NOT EXISTS courier_lat DECIMAL(10, 8),
            ADD COLUMN IF NOT EXISTS courier_lng DECIMAL(11, 8),
            ADD COLUMN IF NOT EXISTS courier_fee DECIMAL(10, 2),
            ADD COLUMN IF NOT EXISTS invited_courier_id UUID
        `);

        console.log('Verificando se a tabela system_config tem pelo menos um registro...');
        const configCheck = await client.query('SELECT id FROM system_config LIMIT 1');
        if (configCheck.rows.length === 0) {
            console.log('Inserindo configuração padrão em system_config...');
            await client.query(`
                INSERT INTO system_config (system_balance, quota_price, loan_interest_rate, courier_price_per_km)
                VALUES (1000, 100, 0.2, 2.50)
            `);
        }

        await client.query('COMMIT');
        console.log('✅ Migração concluída com sucesso!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Erro na migração:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
