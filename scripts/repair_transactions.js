const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function repair() {
    try {
        console.log('--- REPAIRING MISSING TRANSACTIONS ---');
        console.log('This script will backfill transactions for installments that have no corresponding transaction record.');

        // 1. Get all installments
        const installmentsRes = await pool.query(`
            SELECT li.*, l.user_id, l.interest_rate, l.amount as loan_amount, l.total_repayment 
            FROM loan_installments li
            JOIN loans l ON li.loan_id = l.id
            WHERE li.use_balance = true
            ORDER BY li.created_at ASC
        `);

        console.log(`Found ${installmentsRes.rows.length} installments to check.`);

        for (const inst of installmentsRes.rows) {
            // Check if transaction exists (approximate timestamp match within 5 seconds, amounts match)
            const txRes = await pool.query(`
                SELECT id FROM transactions 
                WHERE user_id = $1 
                AND type = 'LOAN_PAYMENT' 
                AND amount = $2
                AND ABS(EXTRACT(EPOCH FROM (created_at - $3::timestamp))) < 5
            `, [inst.user_id, inst.amount, inst.created_at]);

            if (txRes.rows.length === 0) {
                console.log(`MISSING TX for Installment ID ${inst.id} (Loan ${inst.loan_id}, Amount ${inst.amount}, User ${inst.user_id})`);

                // Calculate Metadata (Approximation)
                const principalPortion = inst.amount * (inst.loan_amount / inst.total_repayment);
                const interestPortion = Math.max(0, inst.amount - principalPortion);

                // Insert Transaction
                await pool.query(`
                    INSERT INTO transactions (user_id, type, amount, description, status, metadata, created_at)
                    VALUES ($1, 'LOAN_PAYMENT', $2, $3, 'COMPLETED', $4, $5)
                `, [
                    inst.user_id,
                    inst.amount,
                    `Parcela de Apoio (Saldo) - Reparo Histórico`,
                    JSON.stringify({
                        loanId: inst.loan_id,
                        installmentAmount: parseFloat(inst.amount),
                        isInstallment: true,
                        isRepair: true,
                        principalAmount: principalPortion,
                        interestAmount: interestPortion
                    }),
                    inst.created_at // Use original installment date
                ]);

                console.log(` -> Created Transaction for Local Time ${new Date(inst.created_at).toLocaleString()}`);
            } else {
                console.log(`OK: Installment ${inst.id} has Transaction ${txRes.rows[0].id}`);
            }
        }

    } catch (err) {
        console.error('Fatal repair error:', err);
    } finally {
        await pool.end();
        console.log('Repair Finished.');
    }
}

repair();
