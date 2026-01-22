const { Pool } = require('pg');

async function migrate() {
    const pool = new Pool({
        connectionString: 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
        ssl: true
    });

    try {
        console.log('🚀 Iniciando migração: Refatorando loan_installments...');

        // 1. Adicionar colunas necessárias
        await pool.query(`
            ALTER TABLE loan_installments 
            ADD COLUMN IF NOT EXISTS installment_number INTEGER,
            ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PAID',
            ADD COLUMN IF NOT EXISTS expected_amount NUMERIC(15, 2),
            ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE
        `);
        console.log('✅ Novas colunas adicionadas (installment_number, due_date, status, expected_amount, paid_at).');

        // 2. Ajustar registros antigos (o que já existe é considerado PAID)
        await pool.query(`
            UPDATE loan_installments 
            SET status = 'PAID', 
                paid_at = created_at,
                expected_amount = amount 
            WHERE status IS NULL OR status = 'PAID'
        `);
        console.log('✅ Registros antigos atualizados como PAID.');

        // 3. Tornar colunas status e loan_id obrigatórias para novos registros (opcional)
        // Por enquanto vamos manter flexível.

        console.log('🎊 Migração de loan_installments concluída com sucesso!');
    } catch (err) {
        console.error('❌ Erro na migração:', err);
    } finally {
        await pool.end();
    }
}

migrate();
