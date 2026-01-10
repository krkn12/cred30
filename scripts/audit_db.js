const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

console.log('🔍 Iniciando Auditoria do Banco de Dados Cred30...\n');
console.log('🔍 Iniciando Auditoria do Banco de Dados Cred30...\n');
console.log('Conectando em:', process.env.DATABASE_URL.split('@')[1]); // Log seguro

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const formatCurrency = (val) => {
    return val ? parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
};

async function audit() {
    try {
        // 1. Configuração do Sistema (Financeiro)
        console.log('\n--- 💰 SYSTEM CONFIG (Caixa Central) ---');
        const configRes = await pool.query('SELECT * FROM system_config LIMIT 1');
        if (configRes.rows.length > 0) {
            const c = configRes.rows[0];
            console.log(`System Balance (Caixa Geral): ${formatCurrency(c.system_balance)}`);
            console.log(`Profit Pool (Reserva Cotistas): ${formatCurrency(c.profit_pool)}`);
            console.log(`Total Owner Profit (Empresa):   ${formatCurrency(c.total_owner_profit)}`);
            console.log(`Investment Reserve (Cotas):     ${formatCurrency(c.investment_reserve)}`);
            console.log(`Total Tax Reserve (Impostos):   ${formatCurrency(c.total_tax_reserve)}`);
            console.log(`Total Ops Reserve (Operacional):${formatCurrency(c.total_operational_reserve)}`);
            console.log(`Monthly Costs (Despesas):       ${formatCurrency(c.monthly_fixed_costs)}`);
        } else {
            console.log('⚠️ ERRO: Tabela system_config vazia!');
        }

        // 2. Custos Fixos Cadastrados
        console.log('\n--- 📉 SYSTEM COSTS (Despesas a Pagar) ---');
        const costsRes = await pool.query('SELECT * FROM system_costs');
        if (costsRes.rows.length === 0) console.log('Nenhum custo pendente.');
        costsRes.rows.forEach(cost => {
            console.log(`[${cost.id}] ${cost.description}: ${formatCurrency(cost.amount)} (${cost.is_recurring ? 'Recorrente' : 'Único'})`);
        });

        // 3. Usuários
        console.log('\n--- 👥 USERS SUMMARY ---');
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const usersBalance = await pool.query('SELECT SUM(balance) FROM users');
        console.log(`Total de Usuários: ${usersCount.rows[0].count}`);
        console.log(`Saldo Total nas Carteiras: ${formatCurrency(usersBalance.rows[0].sum)}`);

        const lastUsers = await pool.query('SELECT id, name, email, balance, created_at FROM users ORDER BY created_at DESC LIMIT 3');
        console.log('Últimos 3 usuários cadastrados:');
        lastUsers.rows.forEach(u => console.log(` - ${u.name} (${u.email}): ${formatCurrency(u.balance)}`));

        // 4. Cotas
        console.log('\n--- 💎 QUOTAS SUMMARY ---');
        const quotasCount = await pool.query('SELECT COUNT(*) FROM quotas WHERE status = \'ACTIVE\'');
        console.log(`Total de Cotas Ativas: ${quotasCount.rows[0].count}`);

        // 5. Últimos Logs Administrativos (Auditoria de Ações)
        console.log('\n--- 👮 ADMIN LOGS (Últimas 5 Ações) ---');
        const logsRes = await pool.query(`
            SELECT a.action, a.entity_type, u.name as admin_name, a.created_at, a.new_values 
            FROM admin_logs a 
            LEFT JOIN users u ON a.admin_id = u.id 
            ORDER BY a.created_at DESC LIMIT 5
        `);
        logsRes.rows.forEach(log => {
            console.log(`[${new Date(log.created_at).toLocaleString('pt-BR')}] ${log.admin_name} -> ${log.action} (${log.entity_type})`);
            // console.log(`   Dados: ${JSON.stringify(log.new_values)}`);
        });

    } catch (err) {
        console.error('❌ FATAL ERROR:', err);
    } finally {
        await pool.end();
        console.log('\nAudit Finished.');
    }
}

audit();
