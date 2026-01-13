const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fix() {
    try {
        console.log('--- INICIANDO HOTFIX JOSIAS (EMPRÉSTIMO ID 5) ---');

        // 1. Marcar transação ID 46 como COMPLETED
        await pool.query("UPDATE transactions SET status = 'COMPLETED' WHERE id = 46");
        console.log('✅ Transação 46 marcada como COMPLETED.');

        // 2. Marcar empréstimo ID 5 como PAID
        await pool.query("UPDATE loans SET status = 'PAID' WHERE id = 5");
        console.log('✅ Empréstimo 5 marcado como PAID.');

        // 3. Distribuição Contábil das Reservas (Baseado no valor total de 59.40 - 44.00 = 15.40 de juros)
        const principal = 44.00;
        const interest = 15.40;
        const profitShare = interest * 0.80; // 12.32
        const systemShare = interest * 0.20; // 3.08
        const part = systemShare / 4; // 0.77 para cada reserva

        await pool.query(`
            UPDATE system_config SET 
                investment_reserve = investment_reserve + $1,
                profit_pool = profit_pool + $2,
                system_balance = system_balance + $3,
                total_tax_reserve = total_tax_reserve + $4,
                total_operational_reserve = total_operational_reserve + $5,
                total_owner_profit = total_owner_profit + $6
        `, [principal, profitShare, systemShare, part, part, part]);

        console.log('✅ Reservas do sistema atualizadas.');

    } catch (e) {
        console.error('❌ ERRO NO HOTFIX:', e);
    } finally {
        await pool.end();
        console.log('--- HOTFIX FINALIZADO ---');
    }
}
fix();
