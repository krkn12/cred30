const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function diagnose() {
    try {
        console.log('--- LOAN STATUS DIAGNOSIS (FIXED) ---');
        const userId = 31;

        // Removed remaining_amount column if it doesn't exist
        const res = await pool.query(`
            SELECT id, user_id, amount, status, total_repayment, total_paid, created_at
            FROM loans 
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 5
        `, [userId]);

        const loans = res.rows.map(l => ({
            ...l,
            remaining_calc: (parseFloat(l.total_repayment) - parseFloat(l.total_paid || 0)).toFixed(2)
        }));

        console.table(loans);

        const activeLoan = loans.find(l => ['APPROVED', 'PAYMENT_PENDING'].includes(l.status));
        if (activeLoan) {
            console.log(`\n⚠️ Active Loan Found: ID ${activeLoan.id}, Status: ${activeLoan.status}, Remaining (Calc): ${activeLoan.remaining_calc}`);
            console.log('User has NOT successfully paid off this loan yet.');
        } else {
            console.log('\n✅ No Active Loans found (All PAID or REJECTED).');
            console.log('If user sees loan on frontend, it is a CACHE issue.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

diagnose();
