const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function promoteUsers() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('--- PROMOVENDO USUÁRIOS REAIS ---');

        // 1. Verificar Josias e torná-lo ADMIN se necessário
        const resJosias = await pool.query(
            "UPDATE users SET is_verified = true, role = 'ADMIN' WHERE email = 'josiassm701@gmail.com' RETURNING name, role"
        );
        console.log('Josias:', resJosias.rows[0]);

        // 2. Verificar Bruno
        const resBruno = await pool.query(
            "UPDATE users SET is_verified = true WHERE email = 'carlosbrunoferreira340@gmail.com' RETURNING name, is_verified"
        );
        console.log('Bruno:', resBruno.rows[0]);

        // 3. Verificar o Fabio
        const resFabio = await pool.query(
            "UPDATE users SET is_verified = true WHERE email = 'assm701@gmail.com' RETURNING name, is_verified"
        );
        console.log('Fabio:', resFabio.rows[0]);

        console.log('\n--- SINCRONIZAÇÃO DE STATUS CONCLUÍDA ---');

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await pool.end();
    }
}

promoteUsers();
