require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const userId = 16;
        console.log(`\n=== Detalhes para Luis Fabio (ID: ${userId}) ===`);

        const user = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
        console.log('Informações Básicas:', user.rows[0]);

        const quotas = await pool.query("SELECT * FROM quotas WHERE user_id = $1", [userId]);
        console.log('\nCOTAS:', quotas.rows);

        const txs = await pool.query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at ASC", [userId]);
        console.log('\nTRANSAÇÕES (Ordem Cronológica):');
        txs.rows.forEach(t => {
            console.log(`${t.created_at.toISOString()} | ${t.type} | R$ ${t.amount} | ${t.description}`);
        });

        const deposits = await pool.query("SELECT * FROM deposits WHERE user_id = $1", [userId]);
        console.log('\nDEPÓSITOS:', deposits.rows);

        // Somar todas as transações para ver o saldo real esperado
        let expectedBalance = 0;
        txs.rows.forEach(t => {
            if (t.status === 'APPROVED' || t.status === 'COMPLETED' || t.type === 'DEPOSIT') {
                // Dependendo de como o sistema trata o tipo, credito ou debito
                // Geralmente DEPOSIT, MARKET_SALE, ACADEMY_PAYOUT são crédito
                // QUOTA_PURCHASE, WITHDRAWAL, MARKET_PURCHASE são débito
                const credits = ['DEPOSIT', 'MARKET_SALE', 'ACADEMY_PAYOUT', 'REFUND', 'LOAN_RELEASE'];
                const debits = ['QUOTA_PURCHASE', 'WITHDRAWAL', 'MARKET_PURCHASE', 'LOAN_REPAYMENT', 'LOAN_INSTALLMENT'];

                if (credits.includes(t.type)) {
                    expectedBalance += parseFloat(t.amount);
                } else if (debits.includes(t.type)) {
                    expectedBalance -= parseFloat(t.amount);
                }
            }
        });
        console.log('\n--- CÁLCULO DE SALDO ---');
        console.log('Saldo em Banco:', user.rows[0].balance);
        console.log('Saldo calculado por transações:', expectedBalance.toFixed(2));

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
