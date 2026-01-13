const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const formatBRL = (val) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

async function runAudit() {
    console.log('🚀 INICIANDO AUDITORIA PROFUNDA - CRED30\n');
    console.log('-------------------------------------------');

    try {
        // 0. Listagem de Tabelas
        console.log('📁 ESTRUTURA DO BANCO DE DADOS:');
        const tablesRes = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        for (const row of tablesRes.rows) {
            const countRes = await pool.query(`SELECT COUNT(*) FROM ${row.table_name}`);
            console.log(`- ${row.table_name.padEnd(25)}: ${countRes.rows[0].count} registros`);
        }
        console.log('-------------------------------------------');
        // 1. Visão Geral Financeira (System Config)
        const configRes = await pool.query('SELECT * FROM system_config LIMIT 1');
        const sys = configRes.rows[0] || {};

        console.log('🏦 CAIXA CENTRAL E RESERVAS:');
        console.log(`- Saldo em Caixa (System Balance): ${formatBRL(sys.system_balance)}`);
        console.log(`- Reserva de Lucros (Cotas):       ${formatBRL(sys.profit_pool)}`);
        console.log(`- Reserva de Investimento:         ${formatBRL(sys.investment_reserve)}`);
        console.log(`- Lucro da Empresa (Owner):        ${formatBRL(sys.total_owner_profit)}`);
        console.log(`- Reserva de Impostos:             ${formatBRL(sys.total_tax_reserve)}`);
        console.log(`- Reserva Operacional:             ${formatBRL(sys.total_operational_reserve)}`);
        console.log('-------------------------------------------');

        // 2. Passivo com Usuários (Saldos em Carteira)
        const usersRes = await pool.query('SELECT COUNT(*) as count, SUM(balance) as total_balance FROM users');
        const totalUsers = usersRes.rows[0].count;
        const totalUserLiability = parseFloat(usersRes.rows[0].total_balance || 0);

        console.log('👤 PASSIVO COM USUÁRIOS:');
        console.log(`- Total de Usuários:   ${totalUsers}`);
        console.log(`- Saldo total em carteiras: ${formatBRL(totalUserLiability)}`);

        const coverage = (parseFloat(sys.system_balance || 0) / (totalUserLiability || 1)) * 100;
        console.log(`- Índice de Cobertura (Caixa/Passivo): ${coverage.toFixed(2)}%`);
        console.log('-------------------------------------------');

        // 3. Auditoria de Cotas (Participações)
        const quotasRes = await pool.query(`
            SELECT 
                status, 
                COUNT(*) as count, 
                SUM(purchase_price) as total_invested,
                SUM(current_value) as current_total
            FROM quotas 
            GROUP BY status
        `);

        console.log('💎 AUDITORIA DE COTAS:');
        quotasRes.rows.forEach(q => {
            console.log(`- Status [${q.status}]: ${q.count} cotas | Total: ${formatBRL(q.current_total)}`);
        });
        console.log('-------------------------------------------');

        // 4. Auditoria de Empréstimos (Apoio Mútuo)
        const loansRes = await pool.query(`
            SELECT 
                status, 
                COUNT(*) as count, 
                SUM(amount) as disbursed,
                SUM(total_repayment) as to_receive
            FROM loans 
            GROUP BY status
        `);

        console.log('💸 SAÚDE DO CRÉDITO (APOIO MÚTUO):');
        loansRes.rows.forEach(l => {
            console.log(`- [${l.status}]: ${l.count} contratos | Desembolsado: ${formatBRL(l.disbursed)} | A receber: ${formatBRL(l.to_receive)}`);
        });

        // Verificação de Atrasos
        const overdueRes = await pool.query("SELECT COUNT(*) FROM loans WHERE status = 'APPROVED' AND due_date < NOW()");
        const overdueCount = overdueRes.rows[0].count;
        if (overdueCount > 0) {
            console.log(`⚠️ ALERTA: ${overdueCount} empréstimos estão com vencimento atrasado!`);
        }
        console.log('-------------------------------------------');

        // 5. Transações e Gateways
        const transRes = await pool.query(`
            SELECT 
                type, 
                COUNT(*) as count, 
                SUM(amount) as total 
            FROM transactions 
            WHERE status = 'COMPLETED' 
            GROUP BY type
        `);

        console.log('📊 FLUXO DE CAIXA (TRANSAÇÕES COMPROMETIDAS):');
        transRes.rows.forEach(t => {
            console.log(`- ${t.type.padEnd(12)}: ${t.count.toString().padStart(4)} transações | Total: ${formatBRL(t.total)}`);
        });
        console.log('-------------------------------------------');

        // 6. Inconsistências (Sanity Checks)
        console.log('🕵️ VERIFICAÇÕES DE INTEGRIDADE:');

        // Verificação 1: Usuários com saldo negativo (não permitido)
        const negBal = await pool.query('SELECT COUNT(*) FROM users WHERE balance < 0');
        if (negBal.rows[0].count > 0) {
            console.log(`❌ ERRO: Encontrados ${negBal.rows[0].count} usuários com saldo negativo!`);
        } else {
            console.log('✅ Nenhum usuário com saldo negativo.');
        }

        // Verificação 2: Cotas sem dono
        const orphanQuotas = await pool.query('SELECT COUNT(*) FROM quotas WHERE user_id IS NULL');
        if (orphanQuotas.rows[0].count > 0) {
            console.log(`❌ ERRO: Encontradas ${orphanQuotas.rows[0].count} cotas órfãs (sem dono)!`);
        } else {
            console.log('✅ Todas as cotas possuem proprietário vinculado.');
        }

    } catch (err) {
        console.error('❌ ERRO DURANTE A AUDITORIA:', err.message);
    } finally {
        await pool.end();
        console.log('\n-------------------------------------------');
        console.log('🏁 AUDITORIA FINALIZADA.');
    }
}

runAudit();
