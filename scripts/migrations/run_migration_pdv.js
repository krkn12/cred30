const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🚀 Executando migration: Sistema PDV...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS pdv_charges (
                id SERIAL PRIMARY KEY,
                merchant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount DECIMAL(10, 2) NOT NULL,
                description TEXT,
                confirmation_code VARCHAR(6) NOT NULL,
                status VARCHAR(20) DEFAULT 'PENDING',
                fee_amount DECIMAL(10, 2) DEFAULT 0,
                net_amount DECIMAL(10, 2) DEFAULT 0,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                completed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`CREATE INDEX IF NOT EXISTS idx_pdv_charges_merchant ON pdv_charges(merchant_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_pdv_charges_customer ON pdv_charges(customer_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_pdv_charges_code ON pdv_charges(confirmation_code);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_pdv_charges_status ON pdv_charges(status);`);

        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT FALSE;`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS merchant_name VARCHAR(100);`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS merchant_since TIMESTAMP WITH TIME ZONE;`);

        console.log('✅ Migration PDV executada com sucesso!');

    } catch (error) {
        console.error('❌ Erro na migration:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
