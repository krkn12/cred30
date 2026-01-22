const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function updateMetadata() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Atualizar ID 6 e 7 com serviceFee de 8.00
        const metadata = JSON.stringify({ quantity: 1, serviceFee: 8, paymentMethod: 'balance' });
        const res = await pool.query("UPDATE transactions SET metadata = $1 WHERE id IN (6, 7)", [metadata]);
        console.log(`Sucesso: ${res.rowCount} transações (6, 7) atualizadas com metadados de taxa.`);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

updateMetadata();
