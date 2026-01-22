import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('📊 COTAS NO BANCO:\n');
        const quotas = await client.query(`SELECT * FROM quotas`);
        for (const q of quotas.rows) {
            console.log(`ID: ${q.id} | User: ${q.user_id} | Value: ${q.value} | Current: ${q.current_value} | Status: ${q.status}`);
        }

        console.log('\n📊 TESTE DE LIMITE DE CRÉDITO (User 1):\n');
        const userQuotas = await client.query(`
            SELECT COALESCE(SUM(current_value), 0) as total
            FROM quotas WHERE user_id = 1 AND status = 'ACTIVE'
        `);
        console.log(`Total de cotas ativas do user 1: R$ ${parseFloat(userQuotas.rows[0].total).toFixed(2)}`);

        // Verificar system_balance
        const sys = await client.query(`SELECT system_balance, investment_reserve FROM system_config LIMIT 1`);
        console.log(`\n⚙️ System Balance: R$ ${parseFloat(sys.rows[0].system_balance || 0).toFixed(2)}`);
        console.log(`⚙️ Investment Reserve: R$ ${parseFloat(sys.rows[0].investment_reserve || 0).toFixed(2)}`);

    } finally {
        client.release();
        await pool.end();
    }
}
run();
