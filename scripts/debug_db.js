const { Pool } = require('pg');
const fs = require('fs');

const DATABASE_URL = "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function debug() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    let output = '--- DEBUG FINANCEIRO COMPLETO ---\n\n';

    try {
        // system_config
        const sc = await pool.query("SELECT * FROM system_config");
        output += 'SYSTEM_CONFIG:\n' + JSON.stringify(sc.rows, null, 2) + '\n\n';

        // transactions
        const txs = await pool.query("SELECT * FROM transactions WHERE status IN ('CONFIRMED', 'APPROVED') ORDER BY created_at ASC");
        output += 'TRANSAÇÕES CONFIRMADAS:\n';
        txs.rows.forEach(t => {
            output += `- [${t.created_at.toISOString()}] | ${t.type} | R$ ${t.amount} | ${t.description} | UserID: ${t.user_id}\n`;
        });

        // users balance total
        const users = await pool.query("SELECT id, email, balance, name FROM users");
        output += '\nSALDO DOS USUÁRIOS:\n';
        users.rows.forEach(u => {
            output += `- ${u.email} (${u.name}): R$ ${u.balance}\n`;
        });

        fs.writeFileSync('finance_audit.txt', output);
        console.log('Auditoria completa salva em finance_audit.txt');

    } catch (err) {
        console.error('ERRO:', err);
    } finally {
        await pool.end();
    }
}

debug();
