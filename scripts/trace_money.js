const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

console.log('🕵️‍♀️ Rastreando Origem do Dinheiro...\n');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const formatCurrency = (val) => {
    return val ? parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
};

async function trace() {
    try {
        // 1. Ver System Config (Onde o dinheiro está agora)
        const configRes = await pool.query('SELECT * FROM system_config LIMIT 1');
        if (configRes.rows.length > 0) {
            const c = configRes.rows[0];
            console.log('=== 🏦 CAIXA ATUAL (SYSTEM CONFIG) ===');
            console.log(`Reserva Social (Ativos/Cotas): ${formatCurrency(c.investment_reserve)}`);
            console.log(`Profit Pool (Partes/Dividendos): ${formatCurrency(c.profit_pool)}`);
            console.log(`Caixa Geral: ${formatCurrency(c.system_balance)}\n`);
        }

        // 2. Transações Recentes (De onde veio)
        console.log('=== 🧾 ÚLTIMAS 10 TRANSAÇÕES ===');
        const transRes = await pool.query(`
            SELECT t.id, u.name, t.type, t.amount, t.created_at, t.description 
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
            LIMIT 10
        `);

        if (transRes.rows.length === 0) console.log('Nenhuma transação encontrada.');

        transRes.rows.forEach(t => {
            console.log(`[${new Date(t.created_at).toLocaleString('pt-BR')}] ${t.type} | R$ ${t.amount} | User: ${t.name} | Desc: ${t.description}`);
        });

        // 3. Admin Logs (Injeções Manuais)
        console.log('\n=== 👮 AÇÕES DE ADMIN ===');
        const logsRes = await pool.query(`
            SELECT action, new_values, created_at 
            FROM admin_logs 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        logsRes.rows.forEach(l => {
            console.log(`[${new Date(l.created_at).toLocaleString('pt-BR')}] ${l.action} -> ${JSON.stringify(l.new_values)}`);
        });

        // 4. Cotas Vendidas (Origem comum de reserva)
        const quotasRes = await pool.query('SELECT COUNT(*) FROM quotas');
        console.log(`\n Total de Cotas Vendidas: ${quotasRes.rows[0].count}`);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

trace();
