const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixStuckLoan() {
    try {
        console.log('--- REJECTING STUCK PENDING LOAN ---');

        // Target: Josias (ID 31), Loan PENDING (ID 9 as identified in dump)
        const userId = 31;
        const loanId = 9;

        const check = await pool.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2 AND status = $3', [loanId, userId, 'PENDING']);

        if (check.rows.length === 0) {
            console.log('Loan not found or not in PENDING status.');

            // Backup check: Any pending loan for this user?
            const anyPending = await pool.query('SELECT * FROM loans WHERE user_id = $1 AND status = $2', [userId, 'PENDING']);
            if (anyPending.rows.length > 0) {
                console.log('Found OTHER pending loans:', anyPending.rows.map(l => l.id));
                console.log('Please update script with correct ID.');
            }
            return;
        }

        console.log(`Found Stuck Loan ID ${loanId} for User ${userId}. Amount: ${check.rows[0].amount}`);

        // Update status to REJECTED (cancels the request and frees up limit)
        await pool.query("UPDATE loans SET status = 'REJECTED' WHERE id = $1", [loanId]);

        console.log(`✅ Loan ${loanId} marked as REJECTED. Limit should be restored.`);

    } catch (err) {
        console.error('Fatal fix error:', err);
    } finally {
        await pool.end();
    }
}

fixStuckLoan();
