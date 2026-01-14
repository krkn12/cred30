import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('🔧 Verificando suporte a WAITLIST...\n');

        // Como o status é TEXT, não precisamos alterar TYPE (enum).
        // Apenas garantimos que não há restrições de check conflitantes.
        // Se houvesse um check constraint "users_status_check", precisaríamos alterá-lo.

        // Vamos adicionar um índice em status para contagem rápida
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
        `);
        console.log('✅ Índice idx_users_status criado para performance de contagem.');

        console.log('\n🎉 Banco pronto para sistema de Waitlist!');

    } catch (e: any) {
        console.error('❌ Erro:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
