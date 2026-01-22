
import { Pool, PoolClient } from 'pg';
import { executeInTransaction } from '../../domain/services/transaction.service';

/**
 * Serviço de Proteção de Crédito (FGC-Cred30)
 * Gerencia a cobertura de inadimplência usando o Fundo de Garantia
 */
export const runFGCCoverage = async (pool: Pool): Promise<{ success: boolean; coveredCount: number; totalValue: number }> => {
    try {
        // 1. Buscar empréstimos que estão atrasados há mais de 90 dias e ainda não foram quitados
        const toxicLoansRes = await pool.query(`
            SELECT id, user_id, total_repayment, status
            FROM loans 
            WHERE status IN ('APPROVED', 'PAYMENT_PENDING', 'OVERDUE') 
            AND due_date < NOW() - INTERVAL '90 days'
        `);

        const toxicLoans = toxicLoansRes.rows;
        let coveredCount = 0;
        let totalValue = 0;

        for (const loan of toxicLoans) {
            await executeInTransaction(pool, async (client: PoolClient) => {
                // a. Calcular dívida restante (Saldo Devedor)
                const paidRes = await client.query(
                    'SELECT COALESCE(SUM(amount), 0) as total FROM loan_installments WHERE loan_id = $1',
                    [loan.id]
                );
                const debtAmount = parseFloat(loan.total_repayment) - parseFloat(paidRes.rows[0].total);

                if (debtAmount <= 0) {
                    // Já está quitado, apenas garantir status
                    await client.query("UPDATE loans SET status = 'PAID' WHERE id = $1", [loan.id]);
                    return;
                }

                // b. Verificar saldo disponível no FGC
                const configRes = await client.query('SELECT credit_guarantee_fund FROM system_config LIMIT 1 FOR UPDATE');
                const fgcAvailable = parseFloat(configRes.rows[0].credit_guarantee_fund || '0');

                if (fgcAvailable <= 0) {
                    console.warn(`[FGC-RESCUE] Fundo de Garantia esgotado. Não foi possível cobrir o empréstimo #${loan.id}`);
                    return;
                }

                // Cobrir o que for possível (total ou parcial se fundo estiver baixo)
                const amountToCover = Math.min(debtAmount, fgcAvailable);

                // c. Abater valor do FGC
                await client.query(
                    'UPDATE system_config SET credit_guarantee_fund = credit_guarantee_fund - $1',
                    [amountToCover]
                );

                // d. Registrar a "Quitação por FGC" no cronograma de parcelas
                await client.query(
                    `INSERT INTO loan_installments (loan_id, amount, status, metadata, description)
                     VALUES ($1, $2, 'PAID', $3, $4)`,
                    [
                        loan.id,
                        amountToCover,
                        'PAID',
                        JSON.stringify({ fgc_covered: true, date: new Date().toISOString() }),
                        'Quitação via Fundo de Garantia de Crédito (FGC)'
                    ]
                );

                // e. Atualizar status do empréstimo para 'PAID' (ou 'WRITTEN_OFF' se preferir, mas Josias disse "quitar")
                const isFullyCovered = amountToCover >= debtAmount - 0.01;
                const newStatus = isFullyCovered ? 'PAID' : 'OVERDUE';

                await client.query(
                    'UPDATE loans SET status = $1, metadata = metadata || $2 WHERE id = $3',
                    [
                        newStatus,
                        JSON.stringify({
                            fgc_rescue: true,
                            fgc_amount: amountToCover,
                            rescue_date: new Date().toISOString()
                        }),
                        loan.id
                    ]
                );

                // f. Registrar transação de ajuste sistêmico
                await client.query(
                    `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
                     VALUES ($1, 'SYSTEM_ADJUSTMENT', $2, $3, 'APPROVED', $4)`,
                    [
                        loan.user_id,
                        -amountToCover,
                        `BAIXA POR INADIMPLÊNCIA (FGC): Cobertura sistêmica após 90 dias de atraso.`,
                        JSON.stringify({ loanId: loan.id, fgc: true })
                    ]
                );

                coveredCount++;
                totalValue += amountToCover;
                console.log(`[FGC-RESCUE] Empréstimo #${loan.id} coberto pelo fundo (R$ ${amountToCover.toFixed(2)})`);
            });
        }

        return { success: true, coveredCount, totalValue };
    } catch (error) {
        console.error('Erro no resgate via FGC:', error);
        return { success: false, coveredCount: 0, totalValue: 0 };
    }
};
