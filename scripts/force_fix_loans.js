const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function forceFixLoans() {
    try {
        console.log('=== FORÇANDO CORREÇÃO DE EMPRÉSTIMOS ===\n');

        // Buscar todos os loans ATIVOS que tem remaining <= 0.10
        const loansRes = await pool.query(`
            SELECT l.id, l.status, l.total_repayment,
                   COALESCE((SELECT SUM(CAST(amount AS NUMERIC)) FROM loan_installments WHERE loan_id = l.id), 0) as total_paid
            FROM loans l 
            WHERE l.status IN ('APPROVED', 'PAYMENT_PENDING')
        `);

        console.log(`Encontrados ${loansRes.rows.length} empréstimos ativos.`);

        for (const loan of loansRes.rows) {
            const totalPaid = parseFloat(loan.total_paid);
            const totalRepay = parseFloat(loan.total_repayment);
            const remaining = totalRepay - totalPaid;

            console.log(`\nLoan ID: ${loan.id} | Status: ${loan.status} | Resta: R$ ${remaining.toFixed(2)}`);

            if (remaining <= 0.10) {
                console.log(`  → Marcando como PAID...`);
                const updateRes = await pool.query('UPDATE loans SET status = $1 WHERE id = $2 RETURNING id', ['PAID', loan.id]);
                if (updateRes.rowCount > 0) {
                    console.log(`  ✅ Corrigido com sucesso!`);
                } else {
                    console.log(`  ❌ Falha ao atualizar!`);
                }
            } else {
                console.log(`  → Saldo real devedor. Não corrigir.`);
            }
        }

        console.log('\n=== FIM ===');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

forceFixLoans();
