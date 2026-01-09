import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('💰 Adicionando fundos ao sistema para teste...\n');

        // Adicionar fundos ao sistema
        await client.query(`
            UPDATE system_config 
            SET system_balance = system_balance + 5000,
                investment_reserve = COALESCE(investment_reserve, 0) + 5000
        `);

        // Verificar
        const sys = await client.query(`SELECT system_balance, investment_reserve, profit_pool FROM system_config LIMIT 1`);
        console.log('✅ Fundos adicionados!');
        console.log(`   System Balance: R$ ${parseFloat(sys.rows[0].system_balance).toFixed(2)}`);
        console.log(`   Investment Reserve: R$ ${parseFloat(sys.rows[0].investment_reserve).toFixed(2)}`);
        console.log(`   Profit Pool: R$ ${parseFloat(sys.rows[0].profit_pool).toFixed(2)}`);

        console.log('\n🎉 Agora o sistema tem liquidez para empréstimos!');

    } finally {
        client.release();
        await pool.end();
    }
}
run();
