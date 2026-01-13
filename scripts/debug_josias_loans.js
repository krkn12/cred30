const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function debug() {
    try {
        console.log('=== DEBUG EMPRÉSTIMOS JOSIAS (user_id=31) ===\n');

        // Buscar todos os loans do usuário
        const loansRes = await pool.query(`
            SELECT l.id, l.status, l.amount, l.total_repayment
            FROM loans l 
            WHERE l.user_id = 31 
            ORDER BY l.created_at DESC
        `);

        for (const loan of loansRes.rows) {
            const instRes = await pool.query(
                'SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total_paid FROM loan_installments WHERE loan_id = $1',
                [loan.id]
            );
            const totalPaid = parseFloat(instRes.rows[0].total_paid);
            const totalRepay = parseFloat(loan.total_repayment);
            const remaining = totalRepay - totalPaid;

            console.log(`Loan ID: ${loan.id}`);
            console.log(`  Status: ${loan.status}`);
            console.log(`  Amount: R$ ${parseFloat(loan.amount).toFixed(2)}`);
            console.log(`  Total Repayment: R$ ${totalRepay.toFixed(2)}`);
            console.log(`  Total Paid: R$ ${totalPaid.toFixed(2)}`);
            console.log(`  Remaining: R$ ${remaining.toFixed(2)}`);
            console.log(`  Should be PAID? ${remaining <= 0.10 ? 'YES' : 'NO'}`);
            console.log('');

            // Se deveria estar PAID mas não está, corrigir
            if (remaining <= 0.10 && loan.status !== 'PAID' && loan.status !== 'REJECTED') {
                console.log(`  ⚠️ FIXING: Marking loan ${loan.id} as PAID (remaining is dust)`);
                await pool.query('UPDATE loans SET status = $1 WHERE id = $2', ['PAID', loan.id]);
                console.log(`  ✅ Fixed!`);
            }
        }

        console.log('\n=== FIM DO DEBUG ===');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

debug();
