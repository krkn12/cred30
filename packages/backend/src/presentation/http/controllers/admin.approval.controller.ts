import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, processTransactionApproval, createTransaction, updateUserBalance, updateTransactionStatus } from '../../../domain/services/transaction.service';
import { runAutoLiquidation } from '../../../application/services/auto-liquidation.service';

// Schemas
export const actionSchema = z.object({
    id: z.union([z.string(), z.number()]).transform((val) => {
        if (typeof val === 'string') {
            return val;
        }
        return val.toString();
    }).refine((val) => typeof val === 'string', {
        message: "ID deve ser uma string (UUID) válida"
    }),
    type: z.enum(['TRANSACTION', 'LOAN']),
    action: z.enum(['APPROVE', 'REJECT']),
});

export const payoutActionSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(val => val.toString()),
    type: z.enum(['TRANSACTION', 'LOAN']),
});

export class AdminApprovalController {

    /**
     * Processar ação administrativa (aprovar/rejeitar Transação ou Empréstimo)
     */
    static async processAction(c: Context) {
        try {
            const body = await c.req.json();
            const { id, type, action } = actionSchema.parse(body);

            const pool = getDbPool(c);

            // Executar dentro de transação para garantir consistência
            const result = await executeInTransaction(pool, async (client) => {
                if (type === 'TRANSACTION') {
                    return await processTransactionApproval(client, id, action);
                }
                throw new Error('Tipo de ação não reconhecido');
            });

            if (!result.success) {
                return c.json({
                    success: false,
                    message: result.error
                }, 400);
            }

            return c.json({
                success: true,
                message: `${action === 'APPROVE' ? 'Aprovado' : 'Rejeitado'} com sucesso!`,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            }

            return c.json({
                success: false,
                message: error instanceof Error ? error.message : 'Erro interno do servidor'
            }, 500);
        }
    }

    /**
     * Listar Fila de Pagamentos (Payout Queue)
     */
    static async getPayoutQueue(c: Context) {
        try {
            const pool = getDbPool(c);

            // Buscar transações (saques) aguardando pagamento
            const transactionsResult = await pool.query(
                `SELECT t.*, u.name as user_name, u.email as user_email, u.pix_key as user_pix, u.score as user_score,
                (SELECT COUNT(*) FROM quotas q WHERE q.user_id = t.user_id AND q.status = 'ACTIVE') as user_quotas
         FROM transactions t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.payout_status = 'PENDING_PAYMENT'
         ORDER BY user_quotas DESC, user_score DESC, t.created_at ASC`
            );

            return c.json({
                success: true,
                data: {
                    transactions: transactionsResult.rows,
                    loans: [] // Retornar vazio para compatibilidade
                }
            });
        } catch (error) {
            console.error('Erro ao buscar fila de pagamentos:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Listar Transações Pendentes (Aprovações Iniciais)
     */
    static async getPendingTransactions(c: Context) {
        try {
            const pool = getDbPool(c);

            // Buscar transações que dependem de ação humana (Status PENDING)
            const result = await pool.query(
                `SELECT t.*, u.name as user_name, u.email as user_email, u.pix_key as user_pix, u.phone as user_phone
         FROM transactions t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.status = 'PENDING' 
           AND t.payout_status = 'NONE'
         ORDER BY t.created_at ASC`
            );

            return c.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('Erro ao buscar transações pendentes:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Confirmar Pagamento Efetuado (PIX Manual enviado pelo Admin)
     */
    static async confirmPayout(c: Context) {
        console.log('[CONFIRM-PAYOUT] Iniciando confirmação manual...');
        try {
            const body = await c.req.json();
            const { id, type } = payoutActionSchema.parse(body);
            const pool = getDbPool(c);

            const txResult = await executeInTransaction(pool, async (client) => {
                if (type === 'TRANSACTION') {
                    // Buscar dados da transação e do usuário
                    const txResult = await client.query(
                        `SELECT t.user_id, t.amount, t.metadata, u.pix_key, u.name, u.email
             FROM transactions t
             JOIN users u ON t.user_id = u.id
             WHERE t.id = $1`,
                        [id]
                    );

                    if (txResult.rows.length === 0) {
                        throw new Error('Transação não encontrada');
                    }

                    const { user_id, amount, metadata, pix_key, name } = txResult.rows[0];
                    const netAmount = metadata?.netAmount || parseFloat(amount);
                    const pixKeyToUse = metadata?.pixKey || pix_key;

                    if (!pixKeyToUse) {
                        throw new Error('Usuário não possui chave PIX cadastrada');
                    }

                    // Atualizar status do pagamento para PAID
                    await client.query(
                        `UPDATE transactions 
             SET payout_status = $1, 
                 processed_at = $2, 
                 status = $3,
                 metadata = metadata || $4::jsonb 
             WHERE id = $5`,
                        [
                            'PAID',
                            new Date(),
                            'APPROVED',
                            JSON.stringify({
                                payout_method: 'MANUAL_PIX',
                                confirmed_by_admin: true,
                                confirmed_at: new Date().toISOString()
                            }),
                            id
                        ]
                    );

                    // Criar notificação
                    await client.query(
                        `INSERT INTO notifications (user_id, title, message, type, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            user_id,
                            '💸 Seu saque foi processado!',
                            `O valor de R$ ${netAmount.toFixed(2)} foi enviado para sua chave PIX (${pixKeyToUse}). Confira sua conta!`,
                            'PAYOUT_COMPLETED',
                            JSON.stringify({
                                transactionId: id,
                                amount: netAmount,
                                pixKey: pixKeyToUse
                            }),
                            new Date()
                        ]
                    );

                    return { success: true, netAmount, userName: name?.split(' ')[0] };
                } else {
                    throw new Error('Tipo de confirmação não suportado');
                }
            });

            if (!txResult.success) {
                return c.json({ success: false, message: txResult.error || 'Erro ao processar pagamento' }, 500);
            }

            return c.json({
                success: true,
                message: `Pagamento de R$ ${txResult.data?.netAmount?.toFixed(2)} confirmado para ${txResult.data?.userName || 'usuário'}!`
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            }
            return c.json({ success: false, message: error instanceof Error ? error.message : 'Erro interno' }, 500);
        }
    }

    /**
     * Atualizar PIX de empréstimo (Fix)
     */
    static async fixLoanPix(c: Context) {
        try {
            const body = await c.req.json();
            const { loanId, pixKey } = body;

            if (!loanId || !pixKey) {
                return c.json({ success: false, message: 'loanId e pixKey são obrigatórios' }, 400);
            }

            const pool = getDbPool(c);

            const result = await pool.query(
                'UPDATE loans SET pix_key_to_receive = $1 WHERE id = $2 RETURNING id, pix_key_to_receive',
                [pixKey, loanId]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Empréstimo não encontrado' }, 404);
            }

            return c.json({
                success: true,
                message: 'PIX atualizado com sucesso',
                data: {
                    loanId: result.rows[0].id,
                    pixKey: result.rows[0].pix_key_to_receive
                }
            });
        } catch (error) {
            console.error('Erro ao atualizar PIX do empréstimo:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Aprovar pagamentos de empréstimos pendentes
     */
    static async approvePayment(c: Context) {
        try {
            const body = await c.req.json();
            const { transactionId } = body;

            if (!transactionId) {
                return c.json({ success: false, message: 'transactionId é obrigatório' }, 400);
            }

            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client) => {
                const transactionResult = await client.query(
                    'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
                    [transactionId, 'PENDING']
                );

                if (transactionResult.rows.length === 0) {
                    throw new Error('Transação não encontrada ou já processada');
                }

                // Processar pagamento do empréstimo (lógica completa de amortização estaria aqui, simplificada para aprovação)
                await processTransactionApproval(client, transactionId, 'APPROVE');

                return { success: true };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            return c.json({ success: true, message: 'Pagamento aprovado com sucesso' });

        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Rejeitar Pagamento de Empréstimo
     */
    static async rejectPayment(c: Context) {
        try {
            const body = await c.req.json();
            const { transactionId } = body;

            if (!transactionId) {
                return c.json({ success: false, message: 'transactionId é obrigatório' }, 400);
            }

            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client) => {
                const transactionResult = await client.query(
                    'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
                    [transactionId, 'PENDING']
                );

                if (transactionResult.rows.length === 0) {
                    throw new Error('Transação não encontrada ou já processada');
                }

                const transaction = transactionResult.rows[0];

                if (transaction.type !== 'LOAN_PAYMENT') {
                    throw new Error('Transação não é um pagamento de empréstimo');
                }

                let metadata: any = {};
                try {
                    if (transaction.metadata && typeof transaction.metadata === 'object') {
                        metadata = transaction.metadata;
                    } else {
                        const metadataStr = String(transaction.metadata || '{}').trim();
                        if (metadataStr.startsWith('{') || metadataStr.startsWith('[')) {
                            metadata = JSON.parse(metadataStr);
                        }
                    }
                } catch (error) {
                    console.error('Erro ao fazer parse do metadata (rejeição):', error);
                }

                if (!metadata.loanId) {
                    console.warn('Metadata não contém loanId, prosseguindo apenas com estorno da transação');
                }

                // Reembolsar o cliente se o pagamento foi feito com saldo
                if (metadata.useBalance) {
                    await updateUserBalance(client, transaction.user_id, parseFloat(transaction.amount), 'credit');
                }

                // Reativar o empréstimo para permitir novo pagamento
                if (metadata.loanId) {
                    await client.query(
                        'UPDATE loans SET status = $1 WHERE id = $2',
                        ['APPROVED', metadata.loanId]
                    );
                }

                // Atualizar status da transação para REJEITADO
                await updateTransactionStatus(client, transactionId, 'PENDING', 'REJECTED');

                return {
                    success: true,
                    loanId: metadata.loanId,
                    amountRefunded: metadata.useBalance ? parseFloat(transaction.amount) : 0
                };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            return c.json({
                success: true,
                message: 'Pagamento rejeitado! Empréstimo reativado para novo pagamento.',
                data: result.data
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Aprovar Saque
     */
    static async approveWithdrawal(c: Context) {
        try {
            const body = await c.req.json();
            const { transactionId } = body;

            if (!transactionId) return c.json({ success: false, message: 'transactionId é obrigatório' }, 400);

            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client) => {
                const transactionResult = await client.query(
                    'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
                    [transactionId, 'PENDING']
                );

                if (transactionResult.rows.length === 0) throw new Error('Transação não encontrada ou já processada');

                // Reutiliza a lógica centralizada de aprovação (que já trata taxas, split, etc)
                await processTransactionApproval(client, transactionId, 'APPROVE');

                return { success: true };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);

            return c.json({
                success: true,
                message: 'Saque aprovado com sucesso! Valor líquido deduzido e taxas distribuídas.',
            });

        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Rejeitar Saque
     */
    static async rejectWithdrawal(c: Context) {
        try {
            const body = await c.req.json();
            const { transactionId } = body;

            if (!transactionId) return c.json({ success: false, message: 'transactionId é obrigatório' }, 400);

            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client) => {
                const transactionResult = await client.query(
                    'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
                    [transactionId, 'PENDING']
                );

                if (transactionResult.rows.length === 0) throw new Error('Transação não encontrada ou já processada');

                const transaction = transactionResult.rows[0];
                if (transaction.type !== 'WITHDRAWAL') throw new Error('Transação não é um saque');

                // Reembolsar saldo
                await updateUserBalance(client, transaction.user_id, parseFloat(transaction.amount), 'credit');

                // Rejeitar transação
                await updateTransactionStatus(client, transactionId, 'PENDING', 'REJECTED');

                return { success: true, amountRefunded: parseFloat(transaction.amount) };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);

            return c.json({
                success: true,
                message: 'Saque rejeitado! Valor reembolsado na conta do cliente.',
                data: result.data
            });

        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Liquidar empréstimo usando as cotas do usuário como garantia (Exercer Garantia)
     */
    static async liquidateLoan(c: Context) {
        try {
            const body = await c.req.json();
            const { loanId } = body;

            if (!loanId) {
                return c.json({ success: false, message: 'ID do empréstimo é obrigatório' }, 400);
            }

            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client) => {
                // 1. Buscar empréstimo
                const loanRes = await client.query('SELECT * FROM loans WHERE id = $1 FOR UPDATE', [loanId]);
                if (loanRes.rows.length === 0) throw new Error('Empréstimo não encontrado');
                const loan = loanRes.rows[0];

                if (loan.status === 'PAID') throw new Error('Empréstimo já está quitado');

                // 2. Calcular quanto o usuário deve (Total - já pago)
                const paidRes = await client.query('SELECT COALESCE(SUM(amount), 0) as total FROM loan_installments WHERE loan_id = $1', [loanId]);
                const debtAmount = parseFloat(loan.total_repayment) - parseFloat(paidRes.rows[0].total);

                // 3. Buscar cotas ativas do usuário para liquidar
                const quotasRes = await client.query('SELECT id, current_value FROM quotas WHERE user_id = $1 AND status = $2 FOR UPDATE', [loan.user_id, 'ACTIVE']);
                const userQuotas = quotasRes.rows;

                let liquidatedValue = 0;
                const quotasToLiquidate = [];

                for (const q of userQuotas) {
                    if (liquidatedValue < debtAmount) {
                        liquidatedValue += parseFloat(q.current_value);
                        quotasToLiquidate.push(q.id);
                    }
                }

                if (liquidatedValue === 0) throw new Error('Usuário não possui cotas ativas para garantir a dívida');

                // 4. Executar a liquidação
                if (quotasToLiquidate.length > 0) {
                    await client.query('DELETE FROM quotas WHERE id = ANY($1)', [quotasToLiquidate]);
                }

                await client.query('UPDATE system_config SET system_balance = system_balance + $1', [liquidatedValue]);

                const newStatus = liquidatedValue >= debtAmount ? 'PAID' : loan.status;
                await client.query('UPDATE loans SET status = $1 WHERE id = $2', [newStatus, loanId]);

                const admin = c.get('user');
                await client.query(
                    `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
                     VALUES ($1, 'SYSTEM_LIQUIDATION', $2, $3, 'APPROVED', $4)`,
                    [
                        loan.user_id,
                        liquidatedValue,
                        `Liquidação forçada de ${quotasToLiquidate.length} cota(s) para quitar empréstimo ${loanId}`,
                        JSON.stringify({ adminId: admin.id, loanId, quotasCount: quotasToLiquidate.length })
                    ]
                );

                return { success: true, liquidatedValue, isFullyPaid: newStatus === 'PAID' };
            });

            return c.json(result);
        } catch (error: any) {
            console.error('Erro ao liquidar empréstimo:', error);
            return c.json({ success: false, message: error.message || 'Erro interno' }, 500);
        }
    }

    /**
     * Forçar Liquidação Automática
     */
    static async runLiquidation(c: Context) {
        try {
            const pool = getDbPool(c);
            const result = await runAutoLiquidation(pool);
            return c.json({
                success: true,
                message: `Varredura concluída. ${result.liquidatedCount} garantias executadas.`,
                data: result
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
