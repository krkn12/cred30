require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        const userId = 16;
        const res = await pool.query(`
            SELECT 
                u.score, 
                u.created_at,
                (SELECT COUNT(*) FROM quotas WHERE user_id = $1 AND (status = 'ACTIVE' OR status IS NULL)) as quotas_count,
                (SELECT COALESCE(SUM(current_value), 0) FROM quotas WHERE user_id = $1 AND (status = 'ACTIVE' OR status IS NULL)) as total_quotas_value,
                (SELECT COUNT(*) FROM marketplace_orders WHERE buyer_id = $1 AND status = 'COMPLETED') as marketplace_spent,
                (SELECT COUNT(*) FROM transactions WHERE user_id = $1 AND type = 'BUY_QUOTA' AND status = 'PENDING') as pending_quotas
            FROM users u WHERE u.id = $1
        `, [userId]);

        const data = res.rows[0];
        const quotasCount = parseInt(data.quotas_count);
        const quotasValue = parseFloat(data.total_quotas_value);
        const marketplaceSpent = parseFloat(data.marketplace_spent || 0);

        const totalSpent = marketplaceSpent + (quotasCount * 8.0);
        const maxLoanAmount = Math.floor((totalSpent * 0.8) + (quotasValue * 0.5));

        console.log({
            name: 'Luis Fabio',
            quotasCount,
            quotasValue,
            totalSpent,
            maxLoanAmount,
            pendingQuotas: data.pending_quotas
        });
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
