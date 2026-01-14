import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import {
    QUOTA_PRICE,
    VESTING_PERIOD_MS,
    PENALTY_RATE,
    QUOTA_SHARE_VALUE,
    QUOTA_ADM_FEE,
    QUOTA_FEE_TAX_SHARE,
    QUOTA_FEE_OPERATIONAL_SHARE,
    QUOTA_FEE_OWNER_SHARE,
    QUOTA_FEE_INVESTMENT_SHARE,
    ADMIN_PIX_KEY,
    MAX_QUOTAS_PER_USER
} from '../../../shared/constants/business.constants';
import { UserContext } from '../../../shared/types/hono.types';
import {
    executeInTransaction,
    lockUserBalance,
    updateUserBalance,
    createTransaction
} from '../../../domain/services/transaction.service';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';
import { calculateTotalToPay, PaymentMethod } from '../../../shared/utils/financial.utils';

// Função auxiliar para registrar auditoria financeira
const logFinancialAudit = (operation: string, userId: string, details: any) => {
    console.log(`[AUDIT_FINANCEIRA] ${operation}`, {
        timestamp: new Date().toISOString(),
        userId,
        operation,
        details: JSON.stringify(details),
    });
};

// Esquemas de validação
const buyQuotaSchema = z.object({
    quantity: z.number().int().positive(),
    useBalance: z.boolean(),
    paymentMethod: z.enum(['pix']).optional().default('pix'),
});

const sellQuotaSchema = z.object({
    quotaId: z.union([z.string(), z.number()]).transform((val) => String(val)),
});

export class QuotasController {
    /**
     * Listar cotas do usuário
     */
    static async listQuotas(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(
                'SELECT id, user_id, purchase_price, current_value, purchase_date, status FROM quotas WHERE user_id = $1',
                [user.id]
            );

            const formattedQuotas = result.rows.map(quota => ({
                id: quota.id,
                userId: quota.user_id,
                purchasePrice: parseFloat(quota.purchase_price),
                purchaseDate: new Date(quota.purchase_date).getTime(),
                currentValue: parseFloat(quota.current_value),
                yieldRate: 1.001, // Taxa fixa por enquanto
            }));

            return c.json({
                success: true,
                data: {
                    quotas: formattedQuotas,
                },
            });
        } catch (error) {
            console.error('Erro ao listar cotas:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Comprar cotas
     */
    static async buyQuotas(c: Context) {
        console.log('============================');
        console.log('[QUOTAS /buy] REQUEST RECEIVED AT', new Date().toISOString());
        console.log('============================');
        try {
            const body = await c.req.json();
            console.log('[QUOTAS] Processing /buy request:', JSON.stringify({ ...body, creditCard: 'REDACTED', creditCardHolderInfo: 'REDACTED' }));
            const { quantity, useBalance, paymentMethod } = buyQuotaSchema.parse(body);

            const baseCost = quantity * QUOTA_PRICE;
            const totalAdmFee = quantity * QUOTA_ADM_FEE;
            const totalWithServiceFee = baseCost; // Total é sempre 50 * quantity

            const method: PaymentMethod = useBalance ? 'balance' : (paymentMethod as PaymentMethod);
            const { total: finalCost, fee: userFee } = calculateTotalToPay(totalWithServiceFee, method);

            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            // --- PROTEÇÃO ANTI-BALEIA (ANTI-WHALE) ---
            // 1. Verificar estoque atual do usuário
            const userQuotaCountRes = await pool.query('SELECT COUNT(*) FROM quotas WHERE user_id = $1 AND status = \'ACTIVE\'', [user.id]);
            const currentQuotas = parseInt(userQuotaCountRes.rows[0].count);

            // 2. Bloquear se exceder o limite individual
            if (currentQuotas + quantity > MAX_QUOTAS_PER_USER) {
                return c.json({
                    success: false,
                    message: `Proteção Anti-Concentração Ativa: O limite por associado é de ${MAX_QUOTAS_PER_USER} cotas. Você já possui ${currentQuotas} e tentou comprar mais ${quantity}.`
                }, 403); // Forbidden
            }

            // 3. Travas de Volume por Operação
            if (quantity > 200) { // Trava hardcode operacional (ex: 10k reais)
                return c.json({
                    success: false,
                    message: 'Volume alto detectado. Para aportes acima de 200 cotas, entre em contato com a administração para KYC reforçado.'
                }, 400);
            }

            // Validar limites antigos (podem ser relaxados se a trava anti-baleia for confiável, mas vamos manter por redundância)
            /*
            if (quantity > 20) {
                 // Removido limite de 20 para permitir investidores maiores (até o teto da baleia), mas mantendo a lógica Anti-Whale global
            }
            */

            /*
           if (baseCost > 1000) {
                // Removido também
           }
            */


            const result = await executeInTransaction(pool, async (client) => {
                console.log(`[QUOTAS] Initiating transaction for user ${user.id}, paymentMethod: ${paymentMethod}`);

                if (useBalance) {
                    const balanceCheck = await lockUserBalance(client, user.id, totalWithServiceFee);
                    if (!balanceCheck.success) {
                        throw new Error(balanceCheck.error);
                    }

                    const updateResult = await updateUserBalance(client, user.id, totalWithServiceFee, 'debit');
                    if (!updateResult.success) {
                        throw new Error(updateResult.error);
                    }

                    const values: any[] = [];
                    const placeholders: string[] = [];
                    let pIndex = 1;
                    const now = new Date();

                    for (let i = 0; i < quantity; i++) {
                        placeholders.push(`($${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, 'ACTIVE')`);
                        values.push(user.id, QUOTA_SHARE_VALUE, QUOTA_SHARE_VALUE, now);
                    }

                    await client.query(
                        `INSERT INTO quotas (user_id, purchase_price, current_value, purchase_date, status)
             VALUES ${placeholders.join(', ')}`,
                        values
                    );

                    const transactionResult = await createTransaction(
                        client,
                        user.id,
                        'BUY_QUOTA',
                        totalWithServiceFee,
                        `Aquisição de ${quantity} participação(ões) (+ R$ ${totalAdmFee.toFixed(2)} manutenção) - APROVADA`,
                        'APPROVED',
                        { quantity, useBalance, paymentMethod: 'balance', serviceFee: totalAdmFee }
                    );

                    if (!transactionResult.success) {
                        throw new Error(transactionResult.error);
                    }

                    const currentUserRes = await client.query('SELECT referred_by FROM users WHERE id = $1', [user.id]);
                    const referredByCode = currentUserRes.rows[0]?.referred_by;

                    if (referredByCode) {
                        console.log(`[REFERRAL] Usuário ${user.id} foi indicado pelo código ${referredByCode}. Sistema de Benefício de Boas-Vindas ativo.`);
                    }

                    await updateScore(client, user.id, SCORE_REWARDS.QUOTA_PURCHASE * quantity, `Aquisição de ${quantity} participações`);

                    const taxAmount = totalAdmFee * QUOTA_FEE_TAX_SHARE;
                    const operationalAmount = totalAdmFee * QUOTA_FEE_OPERATIONAL_SHARE;
                    const ownerAmount = totalAdmFee * QUOTA_FEE_OWNER_SHARE;
                    const investmentAmount = totalAdmFee * QUOTA_FEE_INVESTMENT_SHARE;

                    await client.query(`
            UPDATE system_config SET 
              total_tax_reserve = total_tax_reserve + $1,
              total_operational_reserve = total_operational_reserve + $2,
              total_owner_profit = total_owner_profit + $3,
              investment_reserve = COALESCE(investment_reserve, 0) + $4 + ($5::numeric * $6::numeric)
          `, [taxAmount, operationalAmount, ownerAmount, investmentAmount, quantity, QUOTA_SHARE_VALUE]);

                    return {
                        transactionId: transactionResult.transactionId,
                        cost: baseCost,
                        quantity,
                        immediateApproval: true
                    };
                } else {
                    const external_reference = `BUY_QUOTA_${user.id}_${Date.now()}`;

                    const transactionResult = await createTransaction(
                        client,
                        user.id,
                        'BUY_QUOTA',
                        finalCost,
                        `Aquisição de ${quantity} participação(ões) - Aguardando PIX Manual`,
                        'PENDING',
                        {
                            quantity,
                            useBalance,
                            paymentMethod: 'pix',
                            external_reference,
                            baseCost,
                            userFee,
                            manualPix: true
                        }
                    );

                    if (!transactionResult.success) {
                        throw new Error(transactionResult.error);
                    }

                    return {
                        transactionId: transactionResult.transactionId,
                        cost: baseCost,
                        finalCost: finalCost,
                        userFee: userFee,
                        quantity,
                        immediateApproval: false,
                        pixData: null,
                        manualPix: {
                            key: ADMIN_PIX_KEY,
                            owner: 'Cred30',
                            description: `Transferir R$ ${finalCost.toFixed(2)} para ativar ${quantity} participações`
                        }
                    };
                }
            });

            if (!result.success) {
                return c.json({
                    success: false,
                    message: result.error
                }, 400);
            }

            const message = result.data?.immediateApproval
                ? `Aquisição de ${result.data?.quantity} participação(ões) aprovada imediatamente!`
                : 'Solicitação de participação enviada! Aguarde a confirmação do Clube.';

            return c.json({
                success: true,
                message,
                data: {
                    transactionId: result.data?.transactionId,
                    cost: result.data?.cost,
                    finalCost: result.data?.finalCost,
                    userFee: result.data?.userFee,
                    quantity: result.data?.quantity,
                    immediateApproval: result.data?.immediateApproval,
                    pixData: result.data?.pixData,
                    manualPix: result.data?.manualPix
                },
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
     * Vender uma cota
     */
    static async sellQuota(c: Context) {
        try {
            const body = await c.req.json();
            const { quotaId } = sellQuotaSchema.parse(body);

            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            // Verificar se o usuário tem empréstimos ativos OU é fiador
            const activeLoansResult = await pool.query(
                "SELECT COUNT(*) FROM loans WHERE (user_id = $1 OR metadata->>'guarantorId' = $1) AND status IN ('PENDING', 'APPROVED', 'PAYMENT_PENDING')",
                [user.id]
            );

            const activeLoans = parseInt(activeLoansResult.rows[0].count);

            if (activeLoans > 0) {
                return c.json({
                    success: false,
                    message: 'Operação bloqueada: Você possui compromissos ativos. Quite seus débitos antes de ceder participações.'
                }, 400);
            }

            // Buscar cota
            const quotaResult = await pool.query(
                'SELECT * FROM quotas WHERE id = $1 AND user_id = $2',
                [quotaId, user.id]
            );

            if (quotaResult.rows.length === 0) {
                return c.json({ success: false, message: 'Participação não encontrada' }, 404);
            }

            const quota = quotaResult.rows[0];

            // Verificar marketplace
            const listingCheck = await pool.query(
                "SELECT id FROM marketplace_listings WHERE quota_id = $1 AND status = 'ACTIVE'",
                [quotaId]
            );

            if (listingCheck.rows.length > 0) {
                return c.json({
                    success: false,
                    message: 'Esta cota está sendo negociada no Mercado Cred30. Remova o anúncio antes de solicitar o resgate direto.'
                }, 400);
            }

            // Nova Lógica: Liberação anual a partir de 21 de Dezembro
            const now = new Date();
            const currentYear = now.getFullYear();
            const releaseDate = new Date(currentYear, 11, 21); // 21 de Dezembro

            // Liberado se hoje for >= 21 de Dezembro
            const hasSeniority = now.getTime() >= releaseDate.getTime();
            const isEarlyExit = !hasSeniority;

            const originalAmount = parseFloat(quota.purchase_price);
            let finalAmount = originalAmount;
            let penaltyAmount = 0;
            let profitAmount = 0;

            if (isEarlyExit) {
                penaltyAmount = originalAmount * PENALTY_RATE;
                finalAmount = originalAmount - penaltyAmount;
                profitAmount = penaltyAmount;
            }

            const systemStateBefore = await pool.query(`
        SELECT
          (SELECT COALESCE(system_balance, 0) FROM system_config LIMIT 1) as system_balance,
          (SELECT COALESCE(profit_pool, 0) FROM system_config LIMIT 1) as profit_pool,
          0 as operational_cash
      `);

            const auditBefore = {
                quotaId,
                originalAmount,
                penaltyAmount,
                finalAmount,
                profitAmount,
                isEarlyExit,
                systemBalance: systemStateBefore.rows[0]?.system_balance,
                profitPool: systemStateBefore.rows[0]?.profit_pool,
                operationalCash: systemStateBefore.rows[0]?.operational_cash
            };
            logFinancialAudit('VENDA_COTA_ANTES', user.id, auditBefore);

            const txResult = await executeInTransaction(pool, async (client) => {
                console.log(`[SELL_QUOTA] Starting transaction for user ${user.id}, quotaId: ${quotaId}, finalAmount: ${finalAmount}`);

                // VERIFICAÇÃO DE LIQUIDEZ (TRAVA DE SEGURANÇA)
                const liquidityCheck = await client.query('SELECT investment_reserve FROM system_config LIMIT 1 FOR UPDATE');
                const availableLiquidity = parseFloat(liquidityCheck.rows[0]?.investment_reserve || '0');

                if (availableLiquidity < finalAmount) {
                    throw new Error('Liquidez momentaneamente indisponível. Seu capital está investido em empréstimos ativos. Tente novamente em breve.');
                }

                const deleteResult = await client.query(
                    'DELETE FROM quotas WHERE id = $1 AND user_id = $2 RETURNING id',
                    [quotaId, user.id]
                );

                if (deleteResult.rowCount === 0) {
                    throw new Error('Falha ao remover a participação - não encontrada');
                }

                const updateResult = await client.query(
                    'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
                    [finalAmount, user.id]
                );

                if (updateResult.rowCount === 0) {
                    throw new Error('Falha ao atualizar saldo do usuário');
                }

                // DISTRIBUIÇÃO DA MULTA DE RESGATE (PENALTY)
                // 80% para o Sistema (Gestora) e 20% para os Cotistas (Profit Pool)
                if (profitAmount > 0) {
                    const profitPoolShare = profitAmount * 0.20;
                    const systemShare = profitAmount * 0.80;

                    // System Share dividido nas reservas
                    const taxPart = systemShare * QUOTA_FEE_TAX_SHARE;
                    const operPart = systemShare * QUOTA_FEE_OPERATIONAL_SHARE;
                    const ownerPart = systemShare * QUOTA_FEE_OWNER_SHARE;
                    const investPart = systemShare * QUOTA_FEE_INVESTMENT_SHARE;

                    await client.query(`
                        UPDATE system_config SET 
                            profit_pool = profit_pool + $1,
                            total_tax_reserve = total_tax_reserve + $2,
                            total_operational_reserve = total_operational_reserve + $3,
                            total_owner_profit = total_owner_profit + $4,
                            investment_reserve = COALESCE(investment_reserve, 0) + $5
                        `, [profitPoolShare, taxPart, operPart, ownerPart, investPart]
                    );
                }

                // Decrementar do Investment Reserve o valor principal pago ao usuário
                // Isso garante controle da liquidez
                await client.query('UPDATE system_config SET investment_reserve = investment_reserve - $1', [finalAmount]);

                await client.query(
                    `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
           VALUES ($1, 'SELL_QUOTA', $2, $3, 'APPROVED', $4)`,
                    [
                        user.id,
                        finalAmount,
                        `Cessão de participação ${isEarlyExit ? '(Multa 40%)' : '(Integral)'}`,
                        JSON.stringify({
                            originalAmount,
                            penaltyAmount: isEarlyExit ? penaltyAmount : 0,
                            profitAmount: isEarlyExit ? penaltyAmount : 0,
                            isEarlyExit,
                            note: isEarlyExit ? 'Multa de 40% aplicada (direcionada para lucro de juros)' : 'Cessão integral sem penalidade'
                        })
                    ]
                );

                return { newBalance: updateResult.rows[0].balance };
            });

            if (!txResult.success) {
                return c.json({
                    success: false,
                    message: txResult.error || 'Erro ao processar cessão de participação'
                }, 500);
            }

            const systemStateAfter = await pool.query(`
        SELECT
          (SELECT COALESCE(system_balance, 0) FROM system_config LIMIT 1) as system_balance,
          (SELECT COALESCE(profit_pool, 0) FROM system_config LIMIT 1) as profit_pool,
          0 as operational_cash
      `);

            const auditAfter = {
                ...auditBefore,
                newSystemBalance: systemStateAfter.rows[0]?.system_balance,
                newProfitPool: systemStateAfter.rows[0]?.profit_pool,
                newOperationalCash: systemStateAfter.rows[0]?.operational_cash
            };
            logFinancialAudit('VENDA_COTA_APOS', user.id, auditAfter);

            return c.json({
                success: true,
                message: 'Participação cedida com sucesso! Valor creditado no saldo.',
                data: {
                    finalAmount,
                    penaltyAmount: isEarlyExit ? penaltyAmount : 0,
                },
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            }
            console.error('Erro ao vender cota:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Vender todas as cotas
     */
    static async sellAllQuotas(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const activeLoansResult = await pool.query(
                "SELECT COUNT(*) FROM loans WHERE (user_id = $1 OR metadata->>'guarantorId' = $1) AND status IN ('PENDING', 'APPROVED', 'PAYMENT_PENDING')",
                [user.id]
            );

            const activeLoans = parseInt(activeLoansResult.rows[0].count);

            if (activeLoans > 0) {
                return c.json({
                    success: false,
                    message: 'Operação bloqueada: Você possui compromissos ativos. Quite seus débitos antes de ceder participações.'
                }, 400);
            }

            const userQuotasResult = await pool.query(
                'SELECT * FROM quotas WHERE user_id = $1',
                [user.id]
            );

            const userQuotas = userQuotasResult.rows;

            if (userQuotas.length === 0) {
                return c.json({ success: false, message: 'Você não possui participações para cessão' }, 400);
            }

            // Nova Lógica: Liberação anual a partir de 21 de Dezembro
            const now = new Date();
            const currentYear = now.getFullYear();
            const releaseDate = new Date(currentYear, 11, 21); // 21 de Dezembro

            const hasSeniority = now.getTime() >= releaseDate.getTime();

            let totalReceived = 0;
            let totalPenalty = 0;

            for (const quota of userQuotas) {
                const originalAmount = parseFloat(quota.purchase_price);
                let amount = originalAmount;
                let penalty = 0;

                if (!hasSeniority) {
                    penalty = originalAmount * PENALTY_RATE;
                    amount = originalAmount - penalty;
                    totalPenalty += penalty;
                }

                totalReceived += amount;
            }

            const systemStateBefore = await pool.query(`
        SELECT
          (SELECT COALESCE(system_balance, 0) FROM system_config LIMIT 1) as system_balance,
          (SELECT COALESCE(profit_pool, 0) FROM system_config LIMIT 1) as profit_pool,
          0 as operational_cash
      `);

            const auditBefore = {
                totalReceived,
                totalPenalty,
                quotasSold: userQuotas.length,
                hasEarlyExit: totalPenalty > 0,
                systemBalance: systemStateBefore.rows[0]?.system_balance,
                profitPool: systemStateBefore.rows[0]?.profit_pool,
                operationalCash: systemStateBefore.rows[0]?.operational_cash
            };
            logFinancialAudit('VENDA_TODAS_COTAS_ANTES', user.id, auditBefore);

            await executeInTransaction(pool, async (client) => {
                // VERIFICAÇÃO DE LIQUIDEZ (TRAVA DE SEGURANÇA)
                const liquidityCheck = await client.query('SELECT investment_reserve FROM system_config LIMIT 1 FOR UPDATE');
                const availableLiquidity = parseFloat(liquidityCheck.rows[0]?.investment_reserve || '0');

                if (availableLiquidity < totalReceived) {
                    throw new Error('Liquidez momentaneamente indisponível. Seu capital está investido em empréstimos ativos. Tente novamente em breve.');
                }

                await client.query(
                    'DELETE FROM quotas WHERE user_id = $1',
                    [user.id]
                );

                await client.query(
                    'UPDATE users SET balance = balance + $1 WHERE id = $2',
                    [totalReceived, user.id]
                );

                // DISTRIBUIÇÃO DA MULTA DE RESGATE (PENALTY) - SELL ALL
                // 80% para o Sistema (Gestora) e 20% para os Cotistas (Profit Pool)
                // DISTRIBUIÇÃO DA MULTA DE RESGATE (PENALTY) - SELL ALL
                // 80% para o Sistema (Gestora) e 20% para os Cotistas (Profit Pool)
                if (totalPenalty > 0) {
                    const profitPoolShare = totalPenalty * 0.20;
                    const systemShare = totalPenalty * 0.80;

                    // System Share dividido nas reservas
                    const taxPart = systemShare * QUOTA_FEE_TAX_SHARE;
                    const operPart = systemShare * QUOTA_FEE_OPERATIONAL_SHARE;
                    const ownerPart = systemShare * QUOTA_FEE_OWNER_SHARE;
                    const investPart = systemShare * QUOTA_FEE_INVESTMENT_SHARE;

                    await client.query(`
                        UPDATE system_config SET 
                            profit_pool = profit_pool + $1,
                            total_tax_reserve = total_tax_reserve + $2,
                            total_operational_reserve = total_operational_reserve + $3,
                            total_owner_profit = total_owner_profit + $4,
                            investment_reserve = COALESCE(investment_reserve, 0) + $5
                        `, [profitPoolShare, taxPart, operPart, ownerPart, investPart]
                    );
                }

                // Decrementar Liquidez Paga
                await client.query('UPDATE system_config SET investment_reserve = investment_reserve - $1', [totalReceived]);

                await client.query(
                    `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
           VALUES ($1, 'SELL_QUOTA', $2, $3, 'APPROVED', $4)`,
                    [
                        user.id,
                        totalReceived,
                        'Resgate total de licenças',
                        JSON.stringify({
                            totalPenalty,
                            totalProfit: 0,
                            quotasSold: userQuotas.length,
                            hasEarlyExit: totalPenalty > 0,
                            note: totalPenalty > 0 ? 'Multas aplicadas (penalidade, não lucro)' : 'Resgate integral sem penalidade'
                        })
                    ]
                );
            });

            const systemStateAfter = await pool.query(`
        SELECT
          (SELECT COALESCE(system_balance, 0) FROM system_config LIMIT 1) as system_balance,
          (SELECT COALESCE(profit_pool, 0) FROM system_config LIMIT 1) as profit_pool,
          0 as operational_cash
      `);

            const auditAfter = {
                ...auditBefore,
                newSystemBalance: systemStateAfter.rows[0]?.system_balance,
                newProfitPool: systemStateAfter.rows[0]?.profit_pool,
                newOperationalCash: systemStateAfter.rows[0]?.operational_cash
            };
            logFinancialAudit('VENDA_TODAS_COTAS_APOS', user.id, auditAfter);

            return c.json({
                success: true,
                message: `Resgate total realizado! R$ ${totalReceived.toFixed(2)} creditados.`,
                data: {
                    totalReceived,
                    totalPenalty,
                    quotasSold: userQuotas.length,
                },
            });
        } catch (error) {
            console.error('Erro ao vender todas as cotas:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }
}
