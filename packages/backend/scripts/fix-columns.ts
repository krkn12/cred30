import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('🔧 Adicionando colunas que faltam...\n');

        // Adicionar colunas na tabela quotas se não existirem
        try {
            await client.query(`ALTER TABLE quotas ADD COLUMN IF NOT EXISTS value DECIMAL(12,2) DEFAULT 50`);
            console.log('✅ Coluna value adicionada em quotas');
        } catch (e) { }

        try {
            await client.query(`ALTER TABLE quotas ADD COLUMN IF NOT EXISTS vesting_start TIMESTAMPTZ DEFAULT NOW()`);
            console.log('✅ Coluna vesting_start adicionada em quotas');
        } catch (e) { }

        // Mostrar estrutura da tabela quotas
        const columns = await client.query(`
            SELECT column_name, data_type FROM information_schema.columns 
            WHERE table_name = 'quotas' ORDER BY ordinal_position
        `);
        console.log('\n📋 Estrutura da tabela QUOTAS:');
        for (const c of columns.rows) {
            console.log(`   - ${c.column_name}: ${c.data_type}`);
        }

        console.log('\n🎉 Colunas atualizadas!');

    } catch (e: any) {
        console.error('❌ Erro:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
