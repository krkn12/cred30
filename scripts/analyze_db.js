
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: true
});

async function analyze() {
    let output = '--- RELATÓRIO DE AUDITORIA REAL (NEON PROD) ---\n';
    try {
        const tables = ['users', 'quotas', 'loans', 'transactions', 'system_config', 'marketplace_listings'];
        for (const table of tables) {
            try {
                const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                output += `Tabela [${table}]: ${res.rows[0].count} registros\n`;
            } catch (e) { }
        }

        const configRes = await pool.query('SELECT * FROM system_config LIMIT 1');
        if (configRes.rows.length > 0) {
            const cfg = configRes.rows[0];
            output += `\nSAÚDE FINANCEIRA:\n`;
            output += `- Saldo Operacional: R$ ${cfg.system_balance}\n`;
            output += `- Pool de Lucros: R$ ${cfg.profit_pool}\n`;
            output += `- Reserva Fiscal: R$ ${cfg.total_tax_reserve}\n`;
            output += `- Lucro Admin: R$ ${cfg.total_owner_profit}\n`;
        }

        output += `\nLISTAGEM DE TODOS OS USUÁRIOS:\n`;
        const usersRes = await pool.query('SELECT name, email, balance, score, is_verified FROM users');
        usersRes.rows.forEach(u => {
            output += `- ${u.name} | ${u.email} | Saldo: R$ ${u.balance} | Score: ${u.score} | Verificado: ${u.is_verified}\n`;
        });

        output += `\nEMPRÉSTIMOS:\n`;
        const loanRes = await pool.query('SELECT status, count(*), sum(amount) as total FROM loans GROUP BY status');
        loanRes.rows.forEach(r => {
            output += `- Status [${r.status}]: ${r.count} contratos (Soma: R$ ${r.total || 0})\n`;
        });

        const totalBalances = await pool.query('SELECT sum(balance) as total FROM users');
        output += `\nPASSIVO TOTAL: R$ ${totalBalances.rows[0].total || 0}\n`;

        fs.writeFileSync('audit_output.txt', output);
        console.log('Auditoria concluída. Salva em audit_output.txt');

    } catch (err) {
        console.error('ERRO:', err);
    } finally {
        await pool.end();
    }
}

analyze();
