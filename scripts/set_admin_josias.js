const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function setAdmin() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await pool.query(
            "UPDATE users SET is_admin = true, role = 'ADMIN', is_verified = true WHERE email = 'josiassm701@gmail.com'"
        );
        console.log('Josias Silva (josiassm701@gmail.com) agora é ADMINISTRADOR TOTAL no banco real.');
    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await pool.end();
    }
}

setAdmin();
