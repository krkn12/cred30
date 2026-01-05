import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, securityLockMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import {
  ONE_MONTH_MS,
  PENALTY_RATE,
  PLATFORM_FEE_TAX_SHARE,
  PLATFORM_FEE_OPERATIONAL_SHARE,
  PLATFORM_FEE_OWNER_SHARE,
  PLATFORM_FEE_INVESTMENT_SHARE,
  USE_ASAAS,
  ADMIN_PIX_KEY
} from '../../../shared/constants/business.constants';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';
import { createPixPayment, createCardPayment } from '../../../infrastructure/gateways/asaas.service';
import { calculateTotalToPay, PaymentMethod } from '../../../shared/utils/financial.utils';
import { executeInTransaction, processLoanApproval } from '../../../domain/services/transaction.service';
import {
  calculateLoanOffer,
  getCreditAnalysis
} from '../../../application/services/credit-analysis.service';
import { PoolClient } from 'pg';
import { getWelcomeBenefit, consumeWelcomeBenefitUse } from '../../../application/services/welcome-benefit.service';

const loanRoutes = new Hono();

// Aplicar trava de segurança para solicitações e pagamentos
loanRoutes.use('/request', securityLockMiddleware);
loanRoutes.use('/repay', securityLockMiddleware);
loanRoutes.use('/repay-installment', securityLockMiddleware);

// Esquema de validação para solicitação de empréstimo (ATUALIZADO)
const createLoanSchema = z.object({
  amount: z.number().positive(),
  installments: z.number().int().min(1).max(12),
  guaranteePercentage: z.number().int().min(50).max(100).optional().default(100),
});

const cardDataSchema = {
  creditCard: z.object({
    holderName: z.string(),
    number: z.string(),
    expiryMonth: z.string(),
    expiryYear: z.string(),
    ccv: z.string(),
  }).optional(),
  creditCardHolderInfo: z.object({
    name: z.string(),
    email: z.string(),
    cpfCnpj: z.string(),
    postalCode: z.string(),
    addressNumber: z.string(),
    phone: z.string(),
  }).optional(),
};

// Esquema de validação para pagamento de empréstimo
const repayLoanSchema = z.object({
  loanId: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  useBalance: z.boolean(),
  paymentMethod: z.enum(['pix', 'card']).optional().default('pix'),
  installments: z.number().optional(),
  ...cardDataSchema
});

// Esquema de validação para pagamento parcelado
const repayInstallmentSchema = z.object({
  loanId: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  installmentAmount: z.number().positive(),
  useBalance: z.boolean(),
  paymentMethod: z.enum(['pix', 'card']).optional().default('pix'),
  installments: z.number().optional(),
  ...cardDataSchema
});

// Listar empréstimos do usuário
loanRoutes.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const pool = getDbPool(c);

    const result = await pool.query(
      `SELECT l.*,
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
       WHERE l.user_id = $1
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
        isFullyPaid: totalPaid >= parseFloat(loan.total_repayment)
      };
    });

    return c.json({ success: true, data: { loans: formattedLoans } });
  } catch (error) {
    console.error('Erro ao listar empréstimos:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Obter limite de crédito disponível (LUCRO ACUMULADO + COTAS)
loanRoutes.get('/available-limit', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
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
        accumulatedProfit: creditAnalysis.accumulatedProfit || 0,
        quotasValue: creditAnalysis.quotasValue || 0,
        activeDebt: activeDebt,
        remainingLimit: remainingLimit,
        analysis: creditAnalysis
      }
    });
  } catch (error) {
    console.error('Erro ao analisar crédito:', error);
    return c.json({ success: false, message: 'Erro ao analisar crédito' }, 500);
  }
});

// Solicitar empréstimo (COM MÉRITO E GARANTIA FLEXÍVEL)
loanRoutes.post('/request', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { amount, installments, guaranteePercentage } = createLoanSchema.parse(body);

    const user = c.get('user');
    const pool = getDbPool(c);

    // 1. Validar elegibilidade e oferta
    const loanOffer = await calculateLoanOffer(pool, user.id, amount, guaranteePercentage);

    if (!loanOffer.approved) {
      return c.json({
        success: false,
        message: loanOffer.reason || 'Sua solicitação não atende aos critérios de mérito e garantia.'
      }, 400);
    }

    const offer = loanOffer.offer!;

    // 2. Benefício de Boas-Vindas
    const welcomeBenefit = await getWelcomeBenefit(pool, user.id);
    let finalInterestRate = offer.interestRate;
    if (welcomeBenefit.hasDiscount && welcomeBenefit.loanInterestRate < finalInterestRate) {
      finalInterestRate = welcomeBenefit.loanInterestRate;
    }
    const originationRate = welcomeBenefit.loanOriginationFeeRate;

    // Calcular valores
    const originationFee = amount * originationRate;
    const amountToDisburse = amount - originationFee;
    const totalRepayment = amount * (1 + finalInterestRate);

    const result = await executeInTransaction(pool, async (client: PoolClient) => {
      const loanResult = await client.query(
        `INSERT INTO loans (user_id, amount, total_repayment, installments, interest_rate, penalty_rate, status, due_date, term_days, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9)
         RETURNING id`,
        [
          user.id,
          amount,
          totalRepayment,
          installments,
          finalInterestRate,
          PENALTY_RATE,
          new Date(Date.now() + (installments * ONE_MONTH_MS)),
          installments * 30,
          JSON.stringify({
            originationFee,
            disbursedAmount: amountToDisburse,
            guaranteePercentage: offer.guaranteePercentage,
            guaranteeValue: offer.guaranteeValue,
            welcomeBenefitApplied: welcomeBenefit.hasDiscount,
            riskClassInterestRate: offer.interestRate,
            finalInterestRate
          })
        ]
      );

      const newLoanId = loanResult.rows[0].id;

      // Destinar taxas pro sistema
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

      // Tentar auto-aprovação (Liquidez 70% do caixa)
      try {
        const configRes = await client.query('SELECT system_balance FROM system_config LIMIT 1');
        const systemBalance = parseFloat(configRes.rows[0].system_balance);
        const loansRes = await client.query("SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')");
        const totalLoaned = parseFloat(loansRes.rows[0].total);

        const liquidity = (systemBalance * 0.7) - totalLoaned;

        if (amount <= liquidity) {
          await processLoanApproval(client, newLoanId.toString(), 'APPROVE');
          return { loanId: newLoanId, autoApproved: true };
        }
      } catch (e) {
        console.error('Erro auto-aprovação:', e);
      }

      return { loanId: newLoanId, autoApproved: false };
    });

    const isAutoApproved = result.data?.autoApproved;

    return c.json({
      success: true,
      message: isAutoApproved
        ? `Apoio aprovado! R$ ${amountToDisburse.toFixed(2)} já disponível. Garantia de ${offer.guaranteePercentage}% vinculada.`
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
});

// ... (Pagar apoio: /repay e /repay-installment continuam iguais, pois o fluxo de pagamento não mudou)

// [Mantendo as rotas de pagamento originais para não quebrar a funcionalidade]
loanRoutes.post('/repay', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { loanId, useBalance, paymentMethod, installments } = repayLoanSchema.parse(body);

    const user = c.get('user');
    const pool = getDbPool(c);

    const loanResult = await pool.query(
      'SELECT * FROM loans WHERE id = $1 AND user_id = $2',
      [loanId, user.id]
    );

    if (loanResult.rows.length === 0) return c.json({ success: false, message: 'Apoio não encontrado' }, 404);
    const loan = loanResult.rows[0];
    if (loan.status !== 'APPROVED') return c.json({ success: false, message: 'Apoio não disponível para reposição' }, 400);

    const userInfoResult = await pool.query('SELECT cpf, name FROM users WHERE id = $1', [user.id]);
    const userCpf = userInfoResult.rows[0]?.cpf;
    const userName = userInfoResult.rows[0]?.name;

    const totalRepayment = parseFloat(loan.total_repayment);
    const principalAmount = parseFloat(loan.amount);
    const totalInterest = totalRepayment - principalAmount;

    const method: PaymentMethod = useBalance ? 'balance' : (paymentMethod as PaymentMethod);
    const { total: finalCost, fee: userFee } = calculateTotalToPay(totalRepayment, method);

    if (useBalance && user.balance < totalRepayment) return c.json({ success: false, message: 'Saldo insuficiente' }, 400);

    if (useBalance) {
      await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [totalRepayment, user.id]);
    }

    await pool.query('UPDATE loans SET status = $1 WHERE id = $2', ['PAYMENT_PENDING', loanId]);

    let mpData: any = null;
    if (!useBalance) {
      if (USE_ASAAS) {
        if (paymentMethod === 'card' && body.creditCard) {
          mpData = await createCardPayment({
            amount: finalCost,
            description: `Reposição total Cred30`,
            email: user.email,
            external_reference: `REPAY_${loanId}_${Date.now()}`,
            installments: installments,
            cpf: userCpf,
            name: userName,
            creditCard: body.creditCard,
            creditCardHolderInfo: body.creditCardHolderInfo
          });
        } else {
          mpData = await createPixPayment({
            amount: finalCost,
            description: `Reposição total Cred30`,
            email: user.email,
            external_reference: `REPAY_${loanId}_${Date.now()}`,
            cpf: userCpf,
            name: userName
          });
        }
      } else {
        console.log('[LOANS] Manual mode active. Skipping Asaas.');
      }
    }

    const transaction = await pool.query(
      `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
       VALUES ($1, 'LOAN_PAYMENT', $2, $3, 'PENDING', $4) RETURNING id`,
      [
        user.id, finalCost,
        `Reposição de Apoio (${useBalance ? 'Saldo' : 'Asaas'})`,
        JSON.stringify({ loanId, useBalance, paymentMethod, principalAmount, interestAmount: totalInterest, mp_id: mpData?.id, qr_code: mpData?.qr_code })
      ]
    );

    return c.json({
      success: true,
      message: 'Reposição enviada!',
      data: {
        transactionId: transaction.rows[0].id,
        finalCost,
        pixData: mpData,
        manualPix: !USE_ASAAS ? {
          key: ADMIN_PIX_KEY,
          owner: 'Admin Cred30',
          description: `Transferir R$ ${finalCost.toFixed(2)} para quitar apoio`
        } : null
      }
    });
  } catch (error) {
    console.error('Erro ao pagar apoio:', error);
    return c.json({ success: false, message: 'Erro interno' }, 500);
  }
});

loanRoutes.post('/repay-installment', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { loanId, installmentAmount, useBalance, paymentMethod, installments } = repayInstallmentSchema.parse(body);

    const user = c.get('user');
    const pool = getDbPool(c);

    const loanResult = await pool.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2', [loanId, user.id]);
    if (loanResult.rows.length === 0) return c.json({ success: false, message: 'Apoio não encontrado' }, 404);
    const loan = loanResult.rows[0];
    if (loan.status !== 'APPROVED') return c.json({ success: false, message: 'Apoio não está ativo' }, 400);

    const userInfoResult = await pool.query('SELECT cpf, name FROM users WHERE id = $1', [user.id]);
    const userCpf = userInfoResult.rows[0]?.cpf;
    const userName = userInfoResult.rows[0]?.name;

    const paidInstallmentsResult = await pool.query('SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as paid_amount FROM loan_installments WHERE loan_id = $1', [loanId]);
    const paidAmount = parseFloat(paidInstallmentsResult.rows[0].paid_amount);
    const remainingAmountPre = parseFloat(loan.total_repayment) - paidAmount;

    const method: PaymentMethod = useBalance ? 'balance' : (paymentMethod as PaymentMethod);
    const { total: finalInstallmentCost, fee: userFee } = calculateTotalToPay(installmentAmount, method);

    if (installmentAmount > remainingAmountPre) return c.json({ success: false, message: 'Valor excede o restante' }, 400);

    let mpData: any = null;
    if (!useBalance) {
      if (USE_ASAAS) {
        if (paymentMethod === 'card' && body.creditCard) {
          mpData = await createCardPayment({
            amount: finalInstallmentCost,
            description: `Parcela Cred30`,
            email: user.email,
            external_reference: `INST_${loanId}_${Date.now()}`,
            installments: installments,
            cpf: userCpf,
            name: userName,
            creditCard: body.creditCard,
            creditCardHolderInfo: body.creditCardHolderInfo
          });
        } else {
          mpData = await createPixPayment({
            amount: finalInstallmentCost,
            description: `Parcela Cred30`,
            email: user.email,
            external_reference: `INST_${loanId}_${Date.now()}`,
            cpf: userCpf,
            name: userName
          });
        }
      } else {
        console.log('[LOANS] Manual mode active. Skipping Asaas.');
      }

      await pool.query(
        `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
         VALUES ($1, 'LOAN_PAYMENT', $2, $3, 'PENDING', $4)`,
        [user.id, finalInstallmentCost, `Parcela (${paymentMethod})`, JSON.stringify({ loanId, installmentAmount, isInstallment: true, mp_id: mpData?.id, qr_code: mpData?.qr_code })]
      );

      return c.json({
        success: true,
        message: 'Código gerado!',
        data: {
          finalCost: finalInstallmentCost,
          pixData: mpData,
          manualPix: !USE_ASAAS ? {
            key: ADMIN_PIX_KEY,
            owner: 'Admin Cred30',
            description: `Transferir R$ ${finalInstallmentCost.toFixed(2)} para pagar parcela`
          } : null
        }
      });
    }

    if (user.balance < installmentAmount) return c.json({ success: false, message: 'Saldo insuficiente' }, 400);

    await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [installmentAmount, user.id]);
    await pool.query('INSERT INTO loan_installments (loan_id, amount, use_balance, created_at) VALUES ($1, $2, $3, $4)', [loanId, installmentAmount, true, new Date()]);

    const principalPortion = installmentAmount * (parseFloat(loan.amount) / parseFloat(loan.total_repayment));
    const interestPortion = installmentAmount - principalPortion;

    await pool.query('UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2', [principalPortion, interestPortion]);
    await pool.query('UPDATE loans SET total_repayment = total_repayment - $1, amount = amount - $2 WHERE id = $3', [installmentAmount, principalPortion, loanId]);

    const newPaidAmount = paidAmount + installmentAmount;
    if (newPaidAmount >= parseFloat(loan.total_repayment)) {
      await pool.query('UPDATE loans SET status = $1 WHERE id = $2', ['PAID', loanId]);
      await updateScore(pool, user.id, SCORE_REWARDS.LOAN_PAYMENT_ON_TIME, 'Reposição integral em dia');
    }

    return c.json({ success: true, message: 'Parcela paga!', data: { remainingAmount: Math.max(0, remainingAmountPre - installmentAmount) } });
  } catch (error) {
    console.error('Erro ao pagar parcela:', error);
    return c.json({ success: false, message: 'Erro interno' }, 500);
  }
});

export { loanRoutes };