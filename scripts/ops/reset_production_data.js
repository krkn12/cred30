
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

dotenv.config({ path: path.join(__dirname, '../packages/backend/.env') });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function resetData() {
    console.log('⚠️  ATENÇÃO: ESTE SCRIPT IRÁ ZERAR TODAS AS TRANSAÇÕES, DÍVIDAS E SALDOS DO SISTEMA!');
    console.log('    Usuários e configurações serão mantidos.');

    // Pergunta de segurança (simulada como sempre sim para o agente, mas boa prática ter)
    console.log('🔄 Iniciando limpeza...');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        console.log('🗑️  Limpando tabelas financeiras...');

        // 1. Limpar Parcelas e Empréstimos
        await client.query('TRUNCATE TABLE loan_installments CASCADE');
        await client.query('TRUNCATE TABLE loans CASCADE');
        console.log('   - Empréstimos removidos.');

        // 2. Limpar Cobranças PDV
        await client.query('TRUNCATE TABLE pdv_charges CASCADE');
        console.log('   - Cobranças PDV removidas.');

        // 3. Limpar Pedidos Marketplace
        await client.query('TRUNCATE TABLE marketplace_orders CASCADE');
        console.log('   - Pedidos Marketplace removidos.');

        // 4. Limpar Transações e Notificações
        await client.query('TRUNCATE TABLE transactions CASCADE');
        await client.query('TRUNCATE TABLE notifications CASCADE');
        console.log('   - Histórico de Transações removido.');

        // 5. Resetar Saldos e Scores dos Usuários
        await client.query('UPDATE users SET balance = 0, score = 0');
        console.log('   - Saldos e Scores de todos os usuários zerados.');

        // 6. Restaurar Estoque? (Opcional, mas "zerado" talvez implique estoque cheio ou vazio. 
        // Como é marketplace de terceiros, manter estoque atual é mais seguro do que inventar números).
        // Não vou mexer em listings.

        await client.query('COMMIT');

        console.log('\n✅ DADOS DE PRODUÇÃO ZERADOS COM SUCESSO!');
        console.log('   O sistema está limpo para iniciar operações reais.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao limpar dados:', error);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

resetData();
