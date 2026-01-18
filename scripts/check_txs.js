const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function checkTransactions() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('--- AUDITORIA DE TRANSAÇÕES ---');

        const res = await pool.query("SELECT * FROM transactions ORDER BY created_at DESC");
        console.log('TRANSACTIONS FOUND:', res.rows.length);

        res.rows.forEach(tx => {
            console.log(`[${tx.status}] ${tx.type}: R$ ${tx.amount} - ${tx.description} (${tx.created_at})`);
        });

        const users = await pool.query("SELECT email, balance FROM users");
        console.log('\n--- SALDO DOS USUÁRIOS ---');
        users.rows.forEach(u => {
            console.log(`${u.email}: R$ ${u.balance}`);
        });

        const config = await pool.query("SELECT operational_balance FROM system_config");
        console.log(`\nSALDO SISTEMA (operational_balance): R$ ${config.rows[0].operational_balance}`);

    } catch (err) {
        console.error('ERRO:', err);
    } finally {
        await pool.end();
    }
}

checkTransactions();
