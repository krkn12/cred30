const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function reconcile() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('--- RECONCILIAÇÃO FINANCEIRA DETALHADA ---');

        // 1. Pegar todas as transações de DEPÓSITO confirmadas
        const deposits = await pool.query(
            "SELECT id, amount, description, created_at FROM transactions WHERE type = 'DEPOSIT' AND status = 'CONFIRMED'"
        );

        let totalDeposits = 0;
        console.log('\nDEPÓSITOS CONFIRMADOS:');
        deposits.rows.forEach(tx => {
            const val = parseFloat(tx.amount);
            totalDeposits += val;
            console.log(`- ${tx.created_at.toISOString().split('T')[0]} | R$ ${val.toFixed(2)} | ${tx.description}`);
        });
        console.log(`TOTAL DEPOSITADO: R$ ${totalDeposits.toFixed(2)}`);

        // 2. Pegar todas as transações de EMPRÉSTIMO (Saída do sistema)
        const loans = await pool.query(
            "SELECT id, amount, description, created_at FROM transactions WHERE type = 'LOAN' AND status = 'CONFIRMED'"
        );

        let totalLoans = 0;
        console.log('\nEMPRÉSTIMOS (SAÍDAS):');
        loans.rows.forEach(tx => {
            const val = parseFloat(tx.amount);
            totalLoans += val;
            console.log(`- ${tx.created_at.toISOString().split('T')[0]} | R$ ${val.toFixed(2)} | ${tx.description}`);
        });
        console.log(`TOTAL SAÍDA (EMPRÉSTIMOS): R$ ${totalLoans.toFixed(2)}`);

        // 3. Pegar Configuração Atual
        const config = await pool.query("SELECT operational_balance, investment_reserve FROM system_config");
        const currentBalance = parseFloat(config.rows[0]?.operational_balance || 0);

        console.log(`\nSALDO NO BANCO (system_config): R$ ${currentBalance.toFixed(2)}`);

        const recalculated = totalDeposits - totalLoans;
        console.log(`SALDO RECALCULADO (Entradas - Saídas): R$ ${recalculated.toFixed(2)}`);

        if (currentBalance !== recalculated) {
            console.log(`\n⚠️ DIVERGÊNCIA DETECTADA: R$ ${(currentBalance - recalculated).toFixed(2)}`);
            console.log('Ação recomendada: Ajustar system_config para o valor recalculado.');
        } else {
            console.log('\n✅ Saldos batem perfeitamente!');
        }

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await pool.end();
    }
}

reconcile();
