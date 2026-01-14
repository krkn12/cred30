const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function applySql() {
    console.log("🛠️  Aplicando Schema (SQL Direto)...");

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Variantes
            console.log("Criando tabela marketplace_listing_variants...");
            await client.query(`
                CREATE TABLE IF NOT EXISTS marketplace_listing_variants (
                    id SERIAL PRIMARY KEY,
                    listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
                    name VARCHAR(100),
                    color VARCHAR(50),
                    size VARCHAR(50),
                    stock INTEGER DEFAULT 0,
                    price DECIMAL(10, 2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 2. Imagens
            console.log("Criando tabela marketplace_listing_images...");
            await client.query(`
                CREATE TABLE IF NOT EXISTS marketplace_listing_images (
                    id SERIAL PRIMARY KEY,
                    listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
                    image_url TEXT NOT NULL,
                    display_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query('COMMIT');
            console.log("✅ Schema aplicado com sucesso!");

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("ERRO AO APLICAR SQL:", error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

applySql();
