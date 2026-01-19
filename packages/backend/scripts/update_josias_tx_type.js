const { Pool } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function run() {
    const pool = new Pool({ connectionString: DATABASE_URL });
    try {
        console.log('--- Atualizando tipo da transação 17 ---');
        await pool.query("UPDATE transactions SET type = 'POINTS_DEPOSIT' WHERE id = 17");
        console.log('✅ Transação 17 atualizada para POINTS_DEPOSIT');
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await pool.end();
    }
}
run();
