const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../packages/backend/.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    const client = await pool.connect();
    try {
        console.log('Iniciando atualização do Schema para Módulo de Tutores...');
        await client.query('BEGIN');

        // 1. Atualizar Tabela de Usuários (Perfil de Tutor)
        console.log('Atualizando tabela users...');
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_tutor BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS tutor_bio TEXT,
            ADD COLUMN IF NOT EXISTS tutor_price_per_hour DECIMAL(10, 2) DEFAULT 50.00,
            ADD COLUMN IF NOT EXISTS tutor_subjects TEXT, -- JSON ou Texto separado por vírgula
            ADD COLUMN IF NOT EXISTS tutor_rating DECIMAL(3, 2) DEFAULT 5.00
        `);

        // 2. Criar Tabela de Solicitações de Aula
        console.log('Criando tabela tutor_requests...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS tutor_requests (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES users(id),
                tutor_id INTEGER NOT NULL REFERENCES users(id),
                status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, PAID, COMPLETED, REJECTED, CANCELLED
                scheduled_at TIMESTAMP,
                duration_hours INTEGER DEFAULT 1,
                subject TEXT,
                message TEXT,
                price_snapshot DECIMAL(10, 2), -- Preço travado no momento da solicitação
                meeting_link TEXT, -- Link da aula (Meet/Zoom)
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Índices para performance
        await client.query(`CREATE INDEX IF NOT EXISTS idx_tutor_requests_student ON tutor_requests(student_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_tutor_requests_tutor ON tutor_requests(tutor_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_tutor_requests_status ON tutor_requests(status)`);

        await client.query('COMMIT');
        console.log('Schema atualizado com sucesso! 🚀');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Erro ao atualizar schema:', e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
