const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function sweepDust() {
    try {
        console.log('--- LOAN DUST SWEEPER (FIXED) ---');

        const res = await pool.query(`SELECT * FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')`);

        console.log(`Checking ${res.rows.length} active loans for dust...`);

        for (const loan of res.rows) {
            // Try snake_case or camelCase or whatever exists
            const totalRepay = parseFloat(loan.total_repayment || loan.totalRepayment || loan.amount); // Fallback to amount if undefined logic
            const totalPaid = parseFloat(loan.total_paid || loan.totalPaid || 0);

            // Se totalRepayment for undefined, algo está muito errado com o schema
            if (isNaN(totalRepay)) {
                console.log('Skipping loan ' + loan.id + ' due to NaN totalRepay (Keys: ' + Object.keys(loan).join(',') + ')');
                continue;
            }

            const remaining = totalRepay - totalPaid;

            // Tolerance: R$ 0.10
            if (remaining < 0.10) {
                console.log(`🧹 Found Dust Loan ID ${loan.id}. Remaining: ${remaining.toFixed(4)}. MARKING PAID.`);

                await pool.query(`UPDATE loans SET status = 'PAID' WHERE id = $1`, [loan.id]);
            }
        }

        console.log('Sweep finished.');

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

sweepDust();
