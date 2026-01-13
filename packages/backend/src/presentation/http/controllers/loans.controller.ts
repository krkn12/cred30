import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import {
    ONE_MONTH_MS,
    PENALTY_RATE,
    PLATFORM_FEE_TAX_SHARE,
    PLATFORM_FEE_OPERATIONAL_SHARE,
    PLATFORM_FEE_OWNER_SHARE,
    PLATFORM_FEE_INVESTMENT_SHARE,
    ADMIN_PIX_KEY
} from '../../../shared/constants/business.constants';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';
import { calculateTotalToPay, PaymentMethod } from '../../../shared/utils/financial.utils';
import { executeInTransaction, processLoanApproval } from '../../../domain/services/transaction.service';
import {
    calculateLoanOffer,
    getCreditAnalysis
} from '../../../application/services/credit-analysis.service';
import { PoolClient } from 'pg';
import { getWelcomeBenefit, consumeWelcomeBenefitUse } from '../../../application/services/welcome-benefit.service';
import { UserContext } from '../../../shared/types/hono.types';

// Esquemas de validação
const createLoanSchema = z.object({
    amount: z.number().positive(),
    installments: z.number().int().min(1).max(12),
    guaranteePercentage: z.number().int().min(50).max(100).optional().default(100),
    guarantorId: z.string().optional(),
});

const repayLoanSchema = z.object({
    loanId: z.union([z.string(), z.number()]).transform((val) => val.toString()),
    useBalance: z.boolean(),
    paymentMethod: z.enum(['pix']).optional().default('pix'),
});

const repayInstallmentSchema = z.object({
    loanId: z.union([z.string(), z.number()]).transform((val) => val.toString()),
    installmentAmount: z.number().positive(),
    useBalance: z.boolean(),
    paymentMethod: z.enum(['pix']).optional().default('pix'),
});

export class LoansController {
    /**
     * Listar empréstimos do usuário
     */
    static async listLoans(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(
                `SELECT l.*, u.name as requester_name,
                COALESCE(
                  (SELECT json_agg(json_build_object(
                    'id', li.id,
                    'amount', li.amount::float,
                    'useBalance', li.use_balance,
                    'createdAt', li.created_at
                  ) ORDER BY li.created_at ASC)
                   FROM loan_installments li 
                   WHERE li.loan_id = l.id),
                  '[]'
                ) as installments_json
         FROM loans l
         LEFT JOIN users u ON u.id = l.user_id
         WHERE l.user_id = $1 OR l.metadata->>'guarantorId' = $1
         ORDER BY l.created_at DESC`,
                [user.id]
            );

            const formattedLoans = result.rows.map(loan => {
                const paidInstallments = loan.installments_json;
                const totalPaid = paidInstallments.reduce((sum: number, inst: any) => sum + inst.amount, 0);
                const remainingAmount = parseFloat(loan.total_repayment) - totalPaid;

                return {
                    id: loan.id,
                    userId: loan.user_id,
                    amount: parseFloat(loan.amount),
                    totalRepayment: parseFloat(loan.total_repayment),
                    installments: loan.installments,
                    interestRate: parseFloat(loan.interest_rate),
                    requestDate: new Date(loan.created_at).getTime(),
                    status: loan.status,
                    pixKeyToReceive: loan.pix_key_to_receive || '',
                    dueDate: new Date(loan.due_date).getTime(),
                    paidInstallments,
                    totalPaid,
                    remainingAmount,
                    paidInstallmentsCount: paidInstallments.length,
                    isFullyPaid: totalPaid >= parseFloat(loan.total_repayment),
                    requesterName: loan.requester_name || null,
                    isGuarantor: loan.metadata?.guarantorId === user.id
                };
            });

            return c.json({ success: true, data: { loans: formattedLoans } });
        } catch (error) {
            console.error('Erro ao listar empréstimos:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Obter limite de crédito disponível
     */
    static async getAvailableLimit(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const creditAnalysis = await getCreditAnalysis(pool, user.id);

            const activeLoansResult = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) as total FROM loans 
         WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING', 'PENDING')`,
                [user.id]
            );
            const activeDebt = parseFloat(activeLoansResult.rows[0].total);
            const remainingLimit = Math.max(0, creditAnalysis.limit - activeDebt);

            return c.json({
                success: true,
                data: {
                    totalLimit: creditAnalysis.limit,
                    activeDebt: activeDebt,
                    remainingLimit: remainingLimit,
                    analysis: creditAnalysis
                }
            });
        } catch (error) {
            console.error('Erro ao analisar crédito:', error);
            return c.json({ success: false, message: 'Erro ao analisar crédito' }, 500);
        }
    }

    /**
     * Solicitar empréstimo
     */
    static async requestLoan(c: Context) {
        try {
            const body = await c.req.json();
            const { amount, installments, guaranteePercentage, guarantorId } = createLoanSchema.parse(body);

            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const loanOffer = await calculateLoanOffer(pool, user.id, amount, guaranteePercentage, guarantorId);

            if (!loanOffer.approved) {
                return c.json({
                    success: false,
                    message: loanOffer.reason || 'Sua solicitação não atende aos critérios de mérito e garantia.'
                }, 400);
            }

            const offer = loanOffer.offer!;
            const welcomeBenefit = await getWelcomeBenefit(pool, user.id);
            let finalInterestRate = offer.interestRate;
            if (welcomeBenefit.hasDiscount && welcomeBenefit.loanInterestRate < finalInterestRate) {
                finalInterestRate = welcomeBenefit.loanInterestRate;
            }
            const originationRate = welcomeBenefit.loanOriginationFeeRate;

            const originationFee = amount * originationRate;
            const amountToDisburse = amount - originationFee;
            const totalRepayment = amount * (1 + finalInterestRate);

            const initialStatus = guarantorId ? 'WAITING_GUARANTOR' : 'PENDING';

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                const loanResult = await client.query(
                    `INSERT INTO loans (user_id, amount, total_repayment, installments, interest_rate, penalty_rate, status, due_date, term_days, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
                    [
                        user.id,
                        amount,
                        totalRepayment,
                        installments,
                        finalInterestRate,
                        PENALTY_RATE,
                        initialStatus,
                        new Date(Date.now() + (installments * ONE_MONTH_MS)),
                        installments * 30,
                        JSON.stringify({
                            originationFee,
                            disbursedAmount: amountToDisburse,
                            guaranteePercentage: offer.guaranteePercentage,
                            guaranteeValue: offer.guaranteeValue,
                            guarantorId: guarantorId || null,
                            guarantorName: offer.guarantorName || null,
                            welcomeBenefitApplied: welcomeBenefit.hasDiscount,
                            riskClassInterestRate: offer.interestRate,
                            finalInterestRate
                        })
                    ]
                );

                const newLoanId = loanResult.rows[0].id;

                await client.query(
                    `UPDATE system_config SET 
            total_tax_reserve = total_tax_reserve + $1,
            total_operational_reserve = total_operational_reserve + $2,
            total_owner_profit = total_owner_profit + $3,
            investment_reserve = investment_reserve + $4,
            system_balance = system_balance + $5`,
                    [
                        originationFee * PLATFORM_FEE_TAX_SHARE,
                        originationFee * PLATFORM_FEE_OPERATIONAL_SHARE,
                        originationFee * PLATFORM_FEE_OWNER_SHARE,
                        originationFee * PLATFORM_FEE_INVESTMENT_SHARE,
                        originationFee
                    ]
                );

                if (welcomeBenefit.hasDiscount) {
                    await consumeWelcomeBenefitUse(client, user.id, 'LOAN');
                }

                try {
                    const configRes = await client.query('SELECT system_balance FROM system_config LIMIT 1');
                    const systemBalance = parseFloat(configRes.rows[0].system_balance);
                    const loansRes = await client.query("SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')");
                    const totalLoaned = parseFloat(loansRes.rows[0].total);

                    const liquidity = (systemBalance * 0.7) - totalLoaned;

                    if (amount <= liquidity && initialStatus === 'PENDING') {
                        await processLoanApproval(client, newLoanId.toString(), 'APPROVE');
                        return { loanId: newLoanId, autoApproved: true };
                    }
                } catch (e) {
                    console.error('Erro auto-aprovação:', e);
                }

                return { loanId: newLoanId, autoApproved: false };
            });

            if (!result.success) {
                throw new Error(result.error || 'Erro na transação de empréstimo');
            }

            const isAutoApproved = result.data?.autoApproved;

            return c.json({
                success: true,
                message: isAutoApproved
                    ? `Apoio aprovado! R$ ${amountToDisburse.toFixed(2)} já disponível. Garantia de ${offer.guaranteePercentage}% vinculada.`
                    : guarantorId
                        ? `Solicitação enviada! O fiador ${offer.guarantorName} precisa aprovar na conta dele para prosseguir.`
                        : `Solicitação enviada! Aguardando recursos no caixa do Clube Cred30.`,
                data: {
                    loanId: result.data?.loanId,
                    totalRepayment,
                    interestRate: finalInterestRate,
                    guaranteePercentage: offer.guaranteePercentage,
                    autoApproved: isAutoApproved
                }
            });
        } catch (error) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            console.error('Erro ao solicitar apoio:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Repagar empréstimo (Repay)
     */
    static async repayLoan(c: Context) {
        try {
            const body = await c.req.json();
            const { loanId, useBalance, paymentMethod } = repayLoanSchema.parse(body);

            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const loanResult = await pool.query(
                'SELECT * FROM loans WHERE id = $1 AND user_id = $2',
                [loanId, user.id]
            );

            if (loanResult.rows.length === 0) return c.json({ success: false, message: 'Apoio não encontrado' }, 404);
            const loan = loanResult.rows[0];
            if (loan.status !== 'APPROVED') return c.json({ success: false, message: 'Apoio não disponível para reposição' }, 400);

            const principalAmount = parseFloat(loan.amount);
            const totalInterest = totalRepayment - principalAmount;

            const method: PaymentMethod = useBalance ? 'balance' : (paymentMethod as PaymentMethod);
            const { total: finalCost } = calculateTotalToPay(totalRepayment, method);

            if (useBalance && user.balance < totalRepayment) return c.json({ success: false, message: 'Saldo insuficiente' }, 400);

            if (useBalance) {
                // FLUXO DE PAGAMENTO COM SALDO (AUTOMÁTICO)
                await executeInTransaction(pool, async (client: PoolClient) => {
                    // 1. Debitar saldo do usuário
                    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [totalRepayment, user.id]);

                    // 2. Marcar empréstimo como PAGO
                    await client.query('UPDATE loans SET status = $1 WHERE id = $2', ['PAID', loanId]);

                    // 3. Criar transação COMPLETA
                    await client.query(
                        `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
                         VALUES ($1, 'LOAN_PAYMENT', $2, $3, 'COMPLETED', $4)`,
                        [
                            user.id, finalCost,
                            `Reposição de Apoio (Saldo)`,
                            JSON.stringify({ loanId, useBalance: true, principalAmount, interestAmount: totalInterest })
                        ]
                    );

                    // 4. Distribuição Contábil (Mesma lógica das parcelas)
                    const profitShare = totalInterest * 0.80; // 80% dos juros para cotistas
                    const systemShare = totalInterest * 0.20; // 20% dos juros para o sistema
                    const taxPart = systemShare * 0.25;
                    const operPart = systemShare * 0.25;
                    const ownerPart = systemShare * 0.25;
                    const investPart = systemShare * 0.25;

                    await client.query(`
                        UPDATE system_config SET 
                            investment_reserve = COALESCE(investment_reserve, 0) + $1,
                            profit_pool = profit_pool + $2,
                            system_balance = system_balance + $3,
                            total_tax_reserve = total_tax_reserve + $4,
                            total_operational_reserve = total_operational_reserve + $5,
                            total_owner_profit = total_owner_profit + $6
                        `, [principalAmount, profitShare, systemShare, taxPart, operPart, ownerPart]
                    );

                    // 5. Atualizar Score
                    await updateScore(pool, user.id, SCORE_REWARDS.LOAN_PAYMENT_ON_TIME, 'Quitação antecipada total');
                });

                return c.json({ success: true, message: 'Apoio quitado com sucesso!' });
            }

            // FLUXO DE PAGAMENTO VIA PIX (AGUARDA CONFIRMAÇÃO)
            await pool.query('UPDATE loans SET status = $1 WHERE id = $2', ['PAYMENT_PENDING', loanId]);

            const transaction = await pool.query(
                `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
         VALUES ($1, 'LOAN_PAYMENT', $2, $3, 'PENDING', $4) RETURNING id`,
                [
                    user.id, finalCost,
                    `Reposição de Apoio (${useBalance ? 'Saldo' : 'PIX Manual'})`,
                    JSON.stringify({ loanId, useBalance, paymentMethod: 'pix', principalAmount, interestAmount: totalInterest, manualPix: !useBalance })
                ]
            );

            const pixData = !useBalance ? {
                manualPix: {
                    key: ADMIN_PIX_KEY,
                    owner: 'Cred30',
                    amount: finalCost,
                    description: `Reposição de Apoio - ID ${loanId}`
                }
            } : null;

            return c.json({ success: true, message: 'Reposição enviada!', data: { transactionId: transaction.rows[0].id, finalCost, ...pixData } });
        } catch (error) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            console.error('Erro ao pagar apoio:', error);
            return c.json({ success: false, message: 'Erro interno' }, 500);
        }
    }

    /**
     * Pagar parcela (Repay Installment)
     */
    static async repayInstallment(c: Context) {
        try {
            const body = await c.req.json();
            const { loanId, installmentAmount, useBalance, paymentMethod } = repayInstallmentSchema.parse(body);

            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const loanResult = await pool.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2', [loanId, user.id]);
            if (loanResult.rows.length === 0) return c.json({ success: false, message: 'Apoio não encontrado' }, 404);
            const loan = loanResult.rows[0];
            if (loan.status !== 'APPROVED') return c.json({ success: false, message: 'Apoio não está ativo' }, 400);

            const paidInstallmentsResult = await pool.query('SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as paid_amount FROM loan_installments WHERE loan_id = $1', [loanId]);
            const paidAmount = parseFloat(paidInstallmentsResult.rows[0].paid_amount);
            const remainingAmountPre = parseFloat(loan.total_repayment) - paidAmount;

            const method: PaymentMethod = useBalance ? 'balance' : (paymentMethod as PaymentMethod);
            const { total: finalInstallmentCost } = calculateTotalToPay(installmentAmount, method);

            if (installmentAmount > remainingAmountPre) return c.json({ success: false, message: 'Valor excede o restante' }, 400);

            if (!useBalance) {
                await pool.query(
                    `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
           VALUES ($1, 'LOAN_PAYMENT', $2, $3, 'PENDING', $4)`,
                    [user.id, finalInstallmentCost, `Parcela (PIX Manual)`, JSON.stringify({ loanId, installmentAmount, isInstallment: true, manualPix: true })]
                );

                return c.json({
                    success: true,
                    message: 'Realize a transferência PIX para confirmar!',
                    data: {
                        finalCost: finalInstallmentCost,
                        manualPix: {
                            key: ADMIN_PIX_KEY,
                            owner: 'Cred30',
                            amount: finalInstallmentCost,
                            description: `Parcela do Apoio - ID ${loanId}`
                        }
                    }
                });
            }

            if (user.balance < installmentAmount) return c.json({ success: false, message: 'Saldo insuficiente' }, 400);

            await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [installmentAmount, user.id]);
            await pool.query('INSERT INTO loan_installments (loan_id, amount, use_balance, created_at) VALUES ($1, $2, $3, $4)', [loanId, installmentAmount, true, new Date()]);

            const principalPortion = installmentAmount * (parseFloat(loan.amount) / parseFloat(loan.total_repayment));
            const interestPortion = Math.max(0, installmentAmount - principalPortion);

            // DISTRIBUIÇÃO CONTÁBIL CORRETA
            // 1. Principal volta para o fundo de investimento (repor liquidez)
            // 2. Juros: 80% para Cotistas (Profit Pool) e 20% para a Plataforma (Sistema)

            const profitShare = interestPortion * 0.80; // 80% dos juros para cotistas
            const systemShare = interestPortion * 0.20; // 20% dos juros para o sistema

            // Dividir a parte do sistema nas reservas (25% de 20% = 5% do total juros cada)
            const taxPart = systemShare * 0.25;
            const operPart = systemShare * 0.25;
            const ownerPart = systemShare * 0.25;
            const investPart = systemShare * 0.25;

            await pool.query(`
                UPDATE system_config SET 
                    investment_reserve = COALESCE(investment_reserve, 0) + $1,
                    profit_pool = profit_pool + $2,
                    system_balance = system_balance + $3,
                    total_tax_reserve = total_tax_reserve + $4,
                    total_operational_reserve = total_operational_reserve + $5,
                    total_owner_profit = total_owner_profit + $6
                `, [principalPortion, profitShare, systemShare, taxPart, operPart, ownerPart]
            );

            const newPaidAmount = paidAmount + installmentAmount;
            if (newPaidAmount >= parseFloat(loan.total_repayment)) {
                await pool.query('UPDATE loans SET status = $1 WHERE id = $2', ['PAID', loanId]);
                await updateScore(pool, user.id, SCORE_REWARDS.LOAN_PAYMENT_ON_TIME, 'Reposição integral em dia');
            }

            return c.json({ success: true, message: 'Parcela paga!', data: { remainingAmount: Math.max(0, remainingAmountPre - installmentAmount) } });
        } catch (error) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            console.error('Erro ao pagar parcela:', error);
            return c.json({ success: false, message: 'Erro interno' }, 500);
        }
    }

    /**
     * Fiador responde à solicitação (Aceitar/Recusar)
     */
    static async respondToGuarantorRequest(c: Context) {
        try {
            const body = await c.req.json();
            const { loanId, action } = z.object({
                loanId: z.union([z.string(), z.number()]).transform(v => v.toString()),
                action: z.enum(['APPROVE', 'REJECT'])
            }).parse(body);

            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const loanRes = await pool.query(
                `SELECT * FROM loans WHERE id = $1 AND (metadata->>'guarantorId' = $2 OR metadata->>'guarantor_id' = $2) AND status = 'WAITING_GUARANTOR'`,
                [loanId, user.id]
            );

            if (loanRes.rows.length === 0) {
                return c.json({ success: false, message: 'Solicitação de fiança não encontrada ou já processada.' }, 404);
            }

            const loan = loanRes.rows[0];

            if (action === 'REJECT') {
                await pool.query("UPDATE loans SET status = 'REJECTED' WHERE id = $1", [loanId]);
                return c.json({ success: true, message: 'Solicitação de fiança recusada.' });
            }

            // Atualizar para PENDING para que possa ser aprovado
            await pool.query("UPDATE loans SET status = 'PENDING' WHERE id = $1", [loanId]);

            // Tentar auto-aprovação agora que o fiador aceitou
            const result = await executeInTransaction(pool, async (client) => {
                try {
                    const configRes = await client.query('SELECT system_balance FROM system_config LIMIT 1');
                    const systemBalance = parseFloat(configRes.rows[0].system_balance);
                    const loansRes = await client.query("SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')");
                    const totalLoaned = parseFloat(loansRes.rows[0].total);

                    const liquidity = (systemBalance * 0.7) - totalLoaned;

                    if (parseFloat(loan.amount) <= liquidity) {
                        await processLoanApproval(client, loanId, 'APPROVE');
                        return { autoApproved: true };
                    }
                } catch (e) {
                    console.error('Erro auto-aprovação pós-fiança:', e);
                }
                return { autoApproved: false };
            });

            return c.json({
                success: true,
                message: result.data?.autoApproved
                    ? 'Fiança aceita e apoio aprovado!'
                    : 'Fiança aceita! A solicitação agora aguarda análise ou recursos no caixa.'
            });

        } catch (error) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos' }, 400);
            console.error('Erro ao responder fiança:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }
}
