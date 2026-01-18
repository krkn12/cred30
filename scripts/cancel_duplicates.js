const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function update() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await pool.query("UPDATE transactions SET status = 'CANCELED' WHERE id IN (12, 13)");
        console.log('Transações 12 e 13 canceladas com sucesso.');
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

update();
