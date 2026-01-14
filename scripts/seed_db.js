const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: 'packages/backend/.env' });

console.log('🌱 Iniciando Seed (População Inicial) do Banco de Dados...\n');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@cred30.com';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || '123456';
const ADMIN_NAME = 'Josias Admin';

async function seed() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Criar Admin (REMOVIDO - LOGIN VIA GOOGLE)
        console.log(`Skipping manual admin creation for ${ADMIN_EMAIL}. Google Auth will handle it.`);

        // 2. Configurar Sistema (System Config)
        console.log('Initializing System Config...');
        const configCheck = await client.query('SELECT system_balance FROM system_config');
        if (configCheck.rows.length === 0) {
            await client.query(`
                INSERT INTO system_config (
                    system_balance, profit_pool, total_owner_profit, investment_reserve,
                    total_tax_reserve, total_operational_reserve, monthly_fixed_costs,
                    quota_price, loan_interest_rate, penalty_rate
                ) VALUES (
                    0, 0, 0, 0,
                    0, 0, 137.00, -- R$ 87 MEI + R$ 50 Render (Estimado)
                    50.00, 0.20, 0.05
                )
            `);
            console.log('✅ System Config inicializado!');
        } else {
            console.log('ℹ️ System Config já existe.');
        }

        // 3. Criar Custos de Teste (MEI e Render)
        console.log('Adding Test Costs...');
        await client.query('DELETE FROM system_costs'); // Limpar antigos para garantir teste limpo

        await client.query(`
            INSERT INTO system_costs (description, amount, is_recurring, created_at)
            VALUES 
            ('MEI (Mensal)', 87.00, true, NOW()),
            ('Servidor Render', 50.00, true, NOW())
        `);
        console.log('✅ Custos de Teste (MEI/Render) adicionados!');

        await client.query('COMMIT');
        console.log('\n🎉 SEED CONCLUÍDO COM SUCESSO!');
        console.log(`Credenciais Admin: ${ADMIN_EMAIL} / ${ADMIN_PASS}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ ERRO NO SEED:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
