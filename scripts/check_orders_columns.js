
const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    // Fallback for monorepo structure
    dotenv.config({ path: path.resolve(__dirname, 'packages/backend/.env') });
}

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
    console.error("❌ Erro: DATABASE_URL não definida!");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'marketplace_orders';
        `);
        console.table(res.rows);
    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await pool.end();
    }
}

checkColumns();
