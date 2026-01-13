const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function audit() {
    console.log('--- RELATÓRIO DE AUDITORIA TÉCNICA (CRED30) ---');
    try {
        // 1. Integridade das Tabelas
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('\n[1] Estrutura de Tabelas:');
        console.log(tables.rows.map(r => r.table_name).join(' | '));

        // 2. Saúde Financeira (System Config)
        const config = await pool.query("SELECT * FROM system_config LIMIT 1");
        console.log('\n[2] Saúde do Sistema (Config):');
        console.table(config.rows);

        // 3. Status de Empréstimos Críticos
        const loans = await pool.query("SELECT status, count(*) FROM loans GROUP BY status");
        console.log('\n[3] Resumo de Empréstimos:');
        console.table(loans.rows);

        // 4. Últimas 5 Transações
        const txs = await pool.query("SELECT id, type, amount, status, created_at FROM transactions ORDER BY created_at DESC LIMIT 5");
        console.log('\n[4] Últimas Transações:');
        console.table(txs.rows);

        // 5. Inconsistências (Ex: Empréstimos aprovados sem parcelas geradas)
        const ghostLoans = await pool.query(`
            SELECT l.id, l.amount FROM loans l 
            WHERE l.status = 'APPROVED' 
            AND NOT EXISTS (SELECT 1 FROM loan_installments li WHERE li.loan_id = l.id)
            AND l.installments > 0
        `);
        console.log('\n[5] Alerta: Empréstimos sem parcelas (GHOSTS):');
        if (ghostLoans.rows.length > 0) console.table(ghostLoans.rows);
        else console.log('Nenhuma inconsistência detectada.');

    } catch (e) {
        console.error('ERRO NA AUDITORIA:', e.message);
    } finally {
        await pool.end();
    }
}
audit();
