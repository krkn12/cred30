import { Pool, PoolClient } from 'pg';
import { QUOTA_SHARE_VALUE } from '../../shared/constants/business.constants';
import { executeInTransaction, updateUserBalance, createTransaction } from '../../domain/services/transaction.service';
import { logAudit } from './audit.service';
import { notificationService } from './notification.service';

export class LiquidationService {
    /**
     * Verifica e processa liquidações devidas por atraso superior a 35 dias (30 + 5 carência)
     */
    static async processOverdueInstallments(pool: Pool) {
        try {
            // 1. Buscar parcelas PENDENTES com atraso > 35 dias
            const overdueRes = await pool.query(`
                SELECT li.*, l.user_id, u.name as user_name
                FROM loan_installments li
                JOIN loans l ON l.id = li.loan_id
                JOIN users u ON u.id = l.user_id
                WHERE li.status = 'PENDING' 
                  AND li.due_date < NOW() - INTERVAL '35 days'
                ORDER BY li.due_date ASC
            `);

            if (overdueRes.rows.length === 0) return;

            console.log(`[LIQUIDATION] Encontradas ${overdueRes.rows.length} parcelas para liquidação.`);

            for (const installment of overdueRes.rows) {
                await this.liquidateInstallment(pool, installment);
            }
        } catch (error) {
            console.error('[LIQUIDATION_ERROR] Erro ao processar atrasos:', error);
        }
    }

    /**
     * Executa a liquidação de uma parcela específica
     */
    private static async liquidateInstallment(pool: Pool, installment: any) {
        return executeInTransaction(pool, async (client: PoolClient) => {
            const debtAmount = parseFloat(installment.expected_amount);

            // 1. Bloquear usuário e buscar cotas ativas
            const quotasRes = await client.query(
                "SELECT id FROM quotas WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY purchase_date ASC FOR UPDATE",
                [installment.user_id]
            );

            if (quotasRes.rows.length === 0) {
                console.warn(`[LIQUIDATION_FAIL] Usuário ${installment.user_id} não possui cotas para liquidar a parcela ${installment.id}`);
                // Aqui poderíamos marcar o usuário como inadimplente ou avisar o admin
                return;
            }

            const totalQuotasValue = quotasRes.rows.length * QUOTA_SHARE_VALUE;

            // 2. Calcular quantas cotas precisam ser "comidas"
            // Se uma cota vale 42 e a parcela é 100, precisamos de 3 cotas (126). 
            // O troco volta para o saldo do usuário.
            const quotasNeeded = Math.ceil(debtAmount / QUOTA_SHARE_VALUE);
            const quotasToRedeem = quotasRes.rows.slice(0, quotasNeeded);
            const actualRedeemedValue = quotasToRedeem.length * QUOTA_SHARE_VALUE;
            const change = actualRedeemedValue - debtAmount;

            console.log(`[LIQUIDATION_EXEC] Liquidando ${quotasToRedeem.length} cotas de ${installment.user_name} para pagar R$ ${debtAmount}`);

            // 3. Invalidar as cotas
            const quotaIds = quotasToRedeem.map(q => q.id);
            await client.query(
                "UPDATE quotas SET status = 'LIQUIDATED', metadata = metadata || $1::jsonb WHERE id = ANY($2)",
                [JSON.stringify({ liquidationReason: 'OVERDUE_LOAN', installmentId: installment.id }), quotaIds]
            );

            // 4. Se houver troco, creditar no saldo do usuário
            if (change > 0) {
                await updateUserBalance(client, installment.user_id, change, 'credit');
            }

            // 5. Marcar parcela como PAGA
            await client.query(
                "UPDATE loan_installments SET status = 'PAID', amount = $1, use_balance = false, paid_at = NOW(), metadata = metadata || $2::jsonb WHERE id = $3",
                [debtAmount, JSON.stringify({ liquidationApplied: true, quotasCount: quotasToRedeem.length }), installment.id]
            );

            // 6. Registrar Transação de Liquidação
            await createTransaction(
                client,
                installment.user_id,
                'LOAN_PAYMENT',
                debtAmount,
                `Liquidação Automática (Garantia de Cotas) - Parcela ${installment.installment_number}`,
                'APPROVED',
                {
                    loanId: installment.loan_id,
                    installmentId: installment.id,
                    isLiquidation: true,
                    quotasRedeemed: quotasToRedeem.length,
                    redeemedValue: actualRedeemedValue,
                    change
                }
            );

            // 7. Auditoria
            await logAudit(client, {
                userId: installment.user_id,
                action: 'QUOTA_LIQUIDATION_OVERDUE',
                entityType: 'loan_installment',
                entityId: installment.id,
                newValues: { status: 'PAID', liquidatedQuotas: quotasToRedeem.length }
            });

            // 8. Notificar
            notificationService.notifyUser(
                installment.user_id,
                'Execução de Garantia',
                `Uma parcela do seu apoio venceu há mais de 35 dias. Conforme regras, ${quotasToRedeem.length} cota(s) foram liquidadas para quitar o débito.`
            );
        });
    }
}
