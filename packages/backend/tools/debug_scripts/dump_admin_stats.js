const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require"
});

async function getAdminData() {
    try {
        const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COALESCE(SUM(balance), 0) FROM users) as total_user_balances,
        (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE') as total_active_quotas,
        (SELECT COUNT(*) FROM loans WHERE status = 'APPROVED') as total_active_loans,
        (SELECT COUNT(*) FROM loans WHERE status = 'PENDING') as total_pending_loans,
        (SELECT COUNT(*) FROM transactions WHERE status = 'PENDING') as total_pending_transactions,
        (SELECT system_balance FROM system_config LIMIT 1) as system_balance,
        (SELECT profit_pool FROM system_config LIMIT 1) as profit_pool
    `);

        console.log(JSON.stringify(stats.rows[0], null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

getAdminData();
