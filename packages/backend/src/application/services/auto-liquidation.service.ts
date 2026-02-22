
import { Pool, PoolClient } from 'pg';
import { executeInTransaction, incrementSystemReserves } from '../../domain/services/transaction.service';

/**
 * Serviço de Liquidação Automática
 * Varre o sistema em busca de empréstimos atrasados e executa a garantia das cotas
 */
export const runAutoLiquidation = async (pool: Pool): Promise<{ success: boolean; liquidatedCount: number }> => {
    try {
        // 1. Buscar empréstimos que estão atrasados há mais de 5 dias
        const overdueLoansRes = await pool.query(`
            SELECT id, user_id, total_repayment, amount as principal
            FROM loans 
            WHERE status = 'APPROVED' 
            AND due_date < NOW() - INTERVAL '5 days'
        `);

        const overdueLoans = overdueLoansRes.rows;
        let liquidatedCount = 0;

        for (const loan of overdueLoans) {
            await executeInTransaction(pool, async (client: PoolClient) => {
                // a. Calcular dívida restante
                const paidRes = await client.query(
                    'SELECT COALESCE(SUM(amount), 0) as total FROM loan_installments WHERE loan_id = $1',
                    [loan.id]
                );
                const debtAmount = parseFloat(loan.total_repayment) - parseFloat(paidRes.rows[0].total);

                if (debtAmount <= 0) return;

                // b. Buscar cotas ativas do usuário
                // 1. Tentar Liquidar Cotas do Devedor
                const quotasRes = await client.query(
                    'SELECT id, current_value FROM quotas WHERE user_id = $1 AND status = $2 FOR UPDATE',
                    [loan.user_id, 'ACTIVE']
                );
                const userQuotas = quotasRes.rows;

                let totalQuotasValue = 0;
                let remainingDebt = debtAmount;
                const quotasToLiquidate = [];

                // Liquida Primeiro o Devedor
                for (const q of userQuotas) {
                    if (remainingDebt > 0) {
                        const qVal = parseFloat(q.current_value);
                        totalQuotasValue += qVal;
                        remainingDebt -= qVal;
                        quotasToLiquidate.push(q.id);
                    }
                }

                // 2. Se ainda sobrar dívida, buscar Fiador via Metadata
                const loanMeta = loan.metadata || {}; // metadata já deve vir parsed do query se for json, mas check
                const guarantorId = loanMeta.guarantorId;
                const guarantorQuotasToLiquidate = [];
                let guarantorLiquidatedValue = 0;

                if (remainingDebt > 0 && guarantorId) {
                    console.log(`[AUTO-LIQUIDATION] Devedor insuficiente. Executando Fiador: ${guarantorId}`);
                    const gQuotasRes = await client.query(
                        'SELECT id, current_value FROM quotas WHERE user_id = $1 AND status = $2 FOR UPDATE',
                        [guarantorId, 'ACTIVE']
                    );

                    for (const q of gQuotasRes.rows) {
                        if (remainingDebt > 0) {
                            const qVal = parseFloat(q.current_value);
                            guarantorLiquidatedValue += qVal;
                            remainingDebt -= qVal;
                            guarantorQuotasToLiquidate.push(q.id);
                        }
                    }
                }

                const totalLiquidated = totalQuotasValue + guarantorLiquidatedValue;

                if (quotasToLiquidate.length > 0) {
                    await client.query('DELETE FROM quotas WHERE id = ANY($1)', [quotasToLiquidate]);
                }

                if (guarantorQuotasToLiquidate.length > 0) {
                    await client.query('DELETE FROM quotas WHERE id = ANY($1)', [guarantorQuotasToLiquidate]);

                    // Notificar/Registrar para Fiador
                    await client.query(
                        `INSERT INTO transactions (user_id, type, amount, description, status)
                         VALUES ($1, 'SYSTEM_LIQUIDATION', $2, $3, 'APPROVED')`,
                        [
                            guarantorId,
                            guarantorLiquidatedValue,
                            `GARANTIA EXECUTADA: Você cobriu o empréstimo #${loan.id} como fiador.`
                        ]
                    );
                }

                if (totalLiquidated > 0) {
                    // d. Devolver valor ao caixa do sistema
                    await incrementSystemReserves(client, {
                        systemBalance: totalLiquidated
                    });

                    // e. Atualizar status do empréstimo
                    const isFullyCleared = remainingDebt <= 0;
                    const newStatus = isFullyCleared ? 'PAID' : 'OVERDUE';

                    await client.query(
                        'UPDATE loans SET status = $1, metadata = metadata || $2 WHERE id = $3',
                        [
                            newStatus,
                            JSON.stringify({
                                auto_liquidated: true,
                                liquidated_amount: totalLiquidated,
                                liquidation_date: new Date().toISOString(),
                                guarantor_execution: guarantorLiquidatedValue > 0
                            }),
                            loan.id
                        ]
                    );

                    // f. Penalidade Máxima no Score (SÓ DO DEVEDOR)
                    await client.query(
                        'UPDATE users SET score = 0 WHERE id = $1',
                        [loan.user_id]
                    );

                    // g. Registrar transação de liquidação (Devedor)
                    await client.query(
                        `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
                         VALUES ($1, 'SYSTEM_LIQUIDATION', $2, $3, 'APPROVED', $4)`,
                        [
                            loan.user_id,
                            totalQuotasValue,
                            `AUTO-LIQUIDAÇÃO: ${quotasToLiquidate.length} cota(s) suas + ${guarantorQuotasToLiquidate.length} do fiador.`,
                            JSON.stringify({ loanId: loan.id })
                        ]
                    );

                    liquidatedCount++;
                    console.log(`[AUTO-LIQUIDATION] Empréstimo ${loan.id} liquidado (Total: R$ ${totalLiquidated})`);
                }
            });
        }

        return { success: true, liquidatedCount };
    } catch (error: any) {
        console.error('Erro na liquidação automática:', error);
        return { success: false, liquidatedCount: 0 };
    }
};
