
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Adicionando coluna variant_id...");
        await pool.query(`
            ALTER TABLE marketplace_orders 
            ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES marketplace_listing_variants(id);
        `);
        console.log("✅ Coluna variant_id adicionada com sucesso!");
    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await pool.end();
    }
}

run();
