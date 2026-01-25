
import { Pool } from 'pg';

const connectionString = 'postgresql://neondb_owner:npg_ODLh9Hdv7eZR@ep-wild-surf-ahde2n7c.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function resetSystemConfigFull() {
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        console.log('📉 ZERANDO TODAS AS RESERVAS DO SISTEMA EM PRODUÇÃO... 📉');

        await pool.query(`
            UPDATE system_config 
            SET 
                system_balance = 0,
                profit_pool = 0,
                credit_guarantee_fund = 0,
                mutual_reserve = 0,
                investment_reserve = 0,
                total_tax_reserve = 0,
                total_operational_reserve = 0,
                total_corporate_investment_reserve = 0,
                total_owner_profit = 0,
                total_gateway_costs = 0,
                total_manual_costs = 0
        `);

        console.log('✅ System Config Resetado com sucesso.');

        // Vamos checar agora
        const res = await pool.query('SELECT * FROM system_config LIMIT 1');
        console.log('STATUS ATUAL:', res.rows[0]);

    } catch (err) {
        console.error('❌ ERRO:', err);
    } finally {
        await pool.end();
    }
}

resetSystemConfigFull();
