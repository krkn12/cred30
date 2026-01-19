const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function run() {
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        console.log('--- Iniciando correção manual de pontos para o Josias ---');

        // Josias ID = 1
        const userId = 1;
        const amount = 150;

        // Verificar se já existe (evitar duplicata)
        const check = await pool.query(
            "SELECT id FROM transactions WHERE user_id = $1 AND amount = $2 AND type = 'DEPOSIT_POINTS' AND description LIKE '%150 pontos%'",
            [userId, amount]
        );

        if (check.rows.length > 0) {
            console.log('Transação de 150 pontos já existe. Pulando.');
            return;
        }

        // Criar a transação
        const res = await pool.query(
            `INSERT INTO transactions (user_id, type, amount, status, description, created_at, processed_at) 
             VALUES ($1, 'DEPOSIT', $2, 'APPROVED', $3, NOW(), NOW()) 
             RETURNING id`,
            [userId, amount, 'Depósito de Pontos Especial (Josias)']
        );

        console.log('✅ Transação criada com sucesso! ID:', res.rows[0].id);

    } catch (error) {
        console.error('❌ Erro durante a execução:', error);
    } finally {
        await pool.end();
    }
}

run();
