const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function clean() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query("UPDATE transactions SET status = 'CANCELED' WHERE id IN (14, 15)");
        console.log(`Sucesso: ${res.rowCount} transações (14, 15) marcadas como CANCELED.`);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

clean();
