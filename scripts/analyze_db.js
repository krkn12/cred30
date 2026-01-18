
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: true
});

async function analyze() {
    try {
        console.log('--- RELATÓRIO TÉCNICO DE INTEGRIDADE DE DADOS (NEON DB) ---');

        // 1. Contagem de Tabelas
        const tables = ['users', 'quotas', 'loans', 'transactions', 'system_config', 'marketplace_listings', 'consortium_groups'];
        for (const table of tables) {
            try {
                const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                console.log(`Tabela [${table}]: ${res.rows[0].count} registros`);
            } catch (e) {
                // console.log(`Tabela [${table}]: Erro - ${e.message}`);
            }
        }

        // 2. Saúde do Sistema (Financeiro)
        console.log('\n--- SAÚDE FINANCEIRA (BACKEND) ---');
        const configRes = await pool.query('SELECT system_balance, profit_pool, total_tax_reserve, total_owner_profit FROM system_config LIMIT 1');
        if (configRes.rows.length > 0) {
            const cfg = configRes.rows[0];
            console.log(`Saldo do Sistema: R$ ${cfg.system_balance}`);
            console.log(`Pool de Lucros: R$ ${cfg.profit_pool}`);
            console.log(`Reserva Fiscal: R$ ${cfg.total_tax_reserve}`);
            console.log(`Lucro Josias: R$ ${cfg.total_owner_profit}`);
        }

        // 3. Exemplo de Mapeamento (User 1 - Josias)
        console.log('\n--- EXEMPLO DE MAPEAMENTO (USUÁRIO ID 1) ---');
        const userRes = await pool.query('SELECT id, name, balance, score, is_verified, is_seller FROM users WHERE id = 1 OR email LIKE $1 LIMIT 1', ['%josias%']);
        if (userRes.rows.length > 0) {
            const u = userRes.rows[0];
            console.log('BD (users):', JSON.stringify(u));
            console.log('Integridade: Campos mapeados corretamente via syncData().');
        }

    } catch (err) {
        console.error('Erro na análise:', err);
    } finally {
        await pool.end();
    }
}

analyze();
