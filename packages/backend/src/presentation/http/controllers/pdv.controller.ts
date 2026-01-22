import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, createTransaction } from '../../../domain/services/transaction.service';
import { UserContext } from '../../../shared/types/hono.types';
import { PoolClient } from 'pg';
import { getCreditAnalysis, calculateInterestRate, calculateLoanOffer } from '../../../application/services/credit-analysis.service';
import { ONE_MONTH_MS, PENALTY_RATE } from '../../../shared/constants/business.constants';

// Taxa fixa do PDV (3.5%)
const PDV_FEE_RATE = 0.035;
const CODE_EXPIRATION_MINUTES = 5;

/**
 * Gera código de confirmação de 6 dígitos
 */
function generateConfirmationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export class PdvController {
    /**
     * Comerciante inicia uma cobrança (à vista ou parcelada)
     */
    static async createCharge(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();
            const { customerId, amount, description, installments = 1, guaranteePercentage = 100 } = body;

            if (!customerId || !amount) {
                return c.json({ success: false, message: 'ID do cliente e valor são obrigatórios.' }, 400);
            }

            const parsedAmount = parseFloat(amount);
            const parsedInstallments = parseInt(installments);

            if (parsedAmount < 1) {
                return c.json({ success: false, message: 'Valor mínimo é R$ 1,00.' }, 400);
            }

            if (parsedAmount > 5000) {
                return c.json({ success: false, message: 'Valor máximo por transação é R$ 5.000,00.' }, 400);
            }

            if (parsedInstallments < 1 || parsedInstallments > 12) {
                return c.json({ success: false, message: 'Número de parcelas deve ser entre 1 e 12.' }, 400);
            }

            // Buscar dados do cliente
            const customerRes = await pool.query(
                'SELECT id, name, email, balance FROM users WHERE id = $1',
                [customerId]
            );

            if (customerRes.rows.length === 0) {
                return c.json({ success: false, message: 'Cliente não encontrado.' }, 404);
            }

            const customer = customerRes.rows[0];
            const customerBalance = parseFloat(customer.balance);

            // Determinar tipo de pagamento
            const paymentType = parsedInstallments > 1 ? 'CREDIT' : 'BALANCE';
            let interestRate = 0;
            let totalWithInterest = parsedAmount;
            let creditInfo = null;

            // Se parcelado, verificar limite de crédito
            if (paymentType === 'CREDIT') {
                const creditAnalysis = await getCreditAnalysis(pool, customerId);

                if (!creditAnalysis.eligible) {
                    return c.json({
                        success: false,
                        message: `Cliente não elegível para parcelamento: ${creditAnalysis.reason}`
                    }, 400);
                }

                // Verificar se o valor está dentro do limite
                const activeLoansRes = await pool.query(
                    `SELECT COALESCE(SUM(amount), 0) as total FROM loans 
                     WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING', 'PENDING')`,
                    [customerId]
                );
                const activeDebt = parseFloat(activeLoansRes.rows[0].total);
                const remainingLimit = Math.max(0, creditAnalysis.limit - activeDebt);

                if (parsedAmount > remainingLimit) {
                    return c.json({
                        success: false,
                        message: `Limite de crédito insuficiente. Disponível: R$ ${remainingLimit.toFixed(2)}`
                    }, 400);
                }

                // Calcular juros baseado na garantia
                interestRate = calculateInterestRate(guaranteePercentage);
                totalWithInterest = parsedAmount * (1 + interestRate);

                creditInfo = {
                    limit: creditAnalysis.limit,
                    remainingLimit,
                    interestRate: interestRate * 100, // em %
                    totalWithInterest,
                    installmentValue: totalWithInterest / parsedInstallments,
                    guaranteePercentage
                };
            } else {
                // Pagamento à vista - verificar saldo
                if (customerBalance < parsedAmount) {
                    return c.json({
                        success: false,
                        message: `Saldo insuficiente. Saldo: R$ ${customerBalance.toFixed(2)}. Sugestão: parcelar em até 12x no crédito.`,
                        data: { suggestCredit: true, balance: customerBalance }
                    }, 400);
                }
            }

            // Verificar se já existe cobrança pendente para este cliente
            const pendingRes = await pool.query(
                `SELECT id FROM pdv_charges WHERE merchant_id = $1 AND customer_id = $2 AND status = 'PENDING' AND expires_at > NOW()`,
                [user.id, customerId]
            );

            if (pendingRes.rows.length > 0) {
                return c.json({
                    success: false,
                    message: 'Já existe uma cobrança pendente para este cliente. Aguarde expirar ou cancele a anterior.'
                }, 400);
            }

            // Gerar código e criar cobrança
            const code = generateConfirmationCode();
            const feeAmount = parsedAmount * PDV_FEE_RATE;
            const netAmount = parsedAmount - feeAmount;
            const expiresAt = new Date(Date.now() + CODE_EXPIRATION_MINUTES * 60 * 1000);

            const chargeRes = await pool.query(`
                INSERT INTO pdv_charges (merchant_id, customer_id, amount, description, confirmation_code, fee_amount, net_amount, expires_at, payment_type, installments, interest_rate, total_with_interest, guarantee_percentage)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING id, confirmation_code, expires_at
            `, [user.id, customerId, parsedAmount, description || 'Pagamento PDV', code, feeAmount, netAmount, expiresAt, paymentType, parsedInstallments, interestRate, totalWithInterest, guaranteePercentage]);

            const charge = chargeRes.rows[0];

            // Buscar dados do comerciante para mostrar ao cliente
            const merchantRes = await pool.query(
                'SELECT name, merchant_name, pix_key FROM users WHERE id = $1',
                [user.id]
            );
            const merchant = merchantRes.rows[0];

            return c.json({
                success: true,
                message: paymentType === 'CREDIT'
                    ? `Cobrança parcelada criada! ${parsedInstallments}x de R$ ${(totalWithInterest / parsedInstallments).toFixed(2)}`
                    : 'Cobrança criada! Mostre a tela para o cliente confirmar.',
                data: {
                    chargeId: charge.id,
                    confirmationCode: charge.confirmation_code,
                    expiresAt: charge.expires_at,
                    amount: parsedAmount,
                    feeAmount,
                    netAmount,
                    paymentType,
                    installments: parsedInstallments,
                    interestRate: interestRate * 100,
                    totalWithInterest,
                    installmentValue: totalWithInterest / parsedInstallments,
                    customer: {
                        id: customer.id,
                        name: customer.name
                    },
                    merchant: {
                        name: merchant.merchant_name || merchant.name,
                        pixKey: merchant.pix_key ? `****${merchant.pix_key.slice(-4)}` : null
                    },
                    creditInfo
                }
            });
        } catch (error: any) {
            console.error('[PDV] Erro ao criar cobrança:', error);
            return c.json({ success: false, message: error.message || 'Erro ao criar cobrança' }, 500);
        }
    }

    /**
     * Buscar cliente por ID ou CPF
     */
    static async searchCustomer(c: Context) {
        try {
            const pool = getDbPool(c);
            const query = c.req.query('q');

            if (!query || query.length < 2) {
                return c.json({ success: false, message: 'Digite pelo menos 2 caracteres.' }, 400);
            }

            const result = await pool.query(`
                SELECT id, name, email, cpf 
                FROM users 
                WHERE (id::text = $1 OR cpf LIKE $2 OR email ILIKE $3)
                AND status = 'ACTIVE'
                LIMIT 5
            `, [query, `%${query}%`, `%${query}%`]);

            return c.json({
                success: true,
                data: result.rows.map(u => ({
                    id: u.id,
                    name: u.name,
                    email: u.email ? `${u.email.slice(0, 3)}***@***` : null,
                    cpf: u.cpf ? `***.***.***-${u.cpf.slice(-2)}` : null
                }))
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Cliente confirma a cobrança com senha + código
     */
    static async confirmCharge(c: Context) {
        try {
            const pool = getDbPool(c);
            const body = await c.req.json();
            const { customerId, password, confirmationCode } = body;

            if (!customerId || !password || !confirmationCode) {
                return c.json({ success: false, message: 'ID, senha e código são obrigatórios.' }, 400);
            }

            // Importar bcrypt dinamicamente para verificar senha
            const bcrypt = require('bcrypt');

            // Buscar cliente e verificar senha
            const customerRes = await pool.query(
                'SELECT id, name, password_hash, balance FROM users WHERE id = $1',
                [customerId]
            );

            if (customerRes.rows.length === 0) {
                return c.json({ success: false, message: 'Cliente não encontrado.' }, 404);
            }

            const customer = customerRes.rows[0];
            const isPasswordValid = await bcrypt.compare(password, customer.password_hash);

            if (!isPasswordValid) {
                return c.json({ success: false, message: 'Senha incorreta.' }, 401);
            }

            // Buscar cobrança pendente com esse código (incluindo campos de parcelamento)
            const chargeRes = await pool.query(`
                SELECT c.*, u.name as merchant_name, u.pix_key as merchant_pix
                FROM pdv_charges c
                JOIN users u ON c.merchant_id = u.id
                WHERE c.confirmation_code = $1 
                AND c.customer_id = $2 
                AND c.status = 'PENDING'
                AND c.expires_at > NOW()
            `, [confirmationCode, customerId]);

            if (chargeRes.rows.length === 0) {
                return c.json({
                    success: false,
                    message: 'Código inválido, expirado ou não pertence a você.'
                }, 400);
            }

            const charge = chargeRes.rows[0];
            const paymentType = charge.payment_type || 'BALANCE';
            const installments = parseInt(charge.installments) || 1;
            const interestRate = parseFloat(charge.interest_rate) || 0;
            const totalWithInterest = parseFloat(charge.total_with_interest) || parseFloat(charge.amount);
            const guaranteePercentage = parseInt(charge.guarantee_percentage) || 100;

            // Se for pagamento à vista (BALANCE), verificar saldo
            if (paymentType === 'BALANCE') {
                if (parseFloat(customer.balance) < parseFloat(charge.amount)) {
                    return c.json({ success: false, message: 'Saldo insuficiente.' }, 400);
                }
            }

            // Executar transação
            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                let loanId = null;

                if (paymentType === 'CREDIT') {
                    // ===== PAGAMENTO PARCELADO VIA CRÉDITO =====

                    // 1. Criar empréstimo automático
                    const dueDate = new Date(Date.now() + (installments * ONE_MONTH_MS));

                    const loanRes = await client.query(`
                        INSERT INTO loans (user_id, amount, total_repayment, installments, interest_rate, penalty_rate, status, due_date, term_days, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        RETURNING id
                    `, [
                        customerId,
                        parseFloat(charge.amount), // Valor original da compra
                        totalWithInterest, // Valor total a pagar com juros
                        installments,
                        interestRate,
                        PENALTY_RATE,
                        'APPROVED', // Aprovado automaticamente (já verificamos o limite)
                        dueDate,
                        installments * 30,
                        JSON.stringify({
                            pdvChargeId: charge.id,
                            merchantId: charge.merchant_id,
                            merchantName: charge.merchant_name,
                            guaranteePercentage,
                            type: 'PDV_CREDIT',
                            description: charge.description
                        })
                    ]);

                    loanId = loanRes.rows[0].id;

                    // 2. Criar parcelas do empréstimo
                    const installmentValue = totalWithInterest / installments;
                    for (let i = 1; i <= installments; i++) {
                        const installmentDueDate = new Date(Date.now() + (i * ONE_MONTH_MS));
                        await client.query(`
                            INSERT INTO loan_installments (loan_id, installment_number, expected_amount, due_date, status)
                            VALUES ($1, $2, $3, $4, 'PENDING')
                        `, [loanId, i, installmentValue, installmentDueDate]);
                    }

                    // 3. Creditar comerciante à vista (valor líquido)
                    await client.query(
                        'UPDATE users SET balance = balance + $1 WHERE id = $2',
                        [charge.net_amount, charge.merchant_id]
                    );

                    // 4. Atualizar cobrança com loan_id
                    await client.query(
                        `UPDATE pdv_charges SET status = 'COMPLETED', completed_at = NOW(), loan_id = $1 WHERE id = $2`,
                        [loanId, charge.id]
                    );

                    // 5. Registrar transação do comerciante (crédito à vista)
                    await createTransaction(
                        client,
                        charge.merchant_id.toString(),
                        'PDV_RECEIVE',
                        parseFloat(charge.net_amount),
                        `Venda PDV Parcelada (${installments}x) - Cliente ${customer.name}`,
                        'APPROVED',
                        { chargeId: charge.id, customerId, loanId, feeAmount: parseFloat(charge.fee_amount), installments }
                    );

                    // 6. Registrar transação do cliente (empréstimo PDV)
                    await createTransaction(
                        client,
                        customerId.toString(),
                        'PDV_CREDIT',
                        -parseFloat(charge.amount),
                        `Compra PDV Parcelada ${installments}x de R$ ${installmentValue.toFixed(2)} em ${charge.merchant_name}`,
                        'APPROVED',
                        { chargeId: charge.id, merchantId: charge.merchant_id, loanId, totalWithInterest }
                    );

                    // 7. Taxa PDV para o sistema
                    const feeAmount = parseFloat(charge.fee_amount);
                    await client.query(`
                        UPDATE system_config SET 
                            total_tax_reserve = total_tax_reserve + $1,
                            total_operational_reserve = total_operational_reserve + $2,
                            total_owner_profit = total_owner_profit + $3,
                            investment_reserve = investment_reserve + $4
                    `, [feeAmount * 0.25, feeAmount * 0.25, feeAmount * 0.25, feeAmount * 0.25]);

                } else {
                    // ===== PAGAMENTO À VISTA (SALDO) =====

                    // Debitar do cliente
                    await client.query(
                        'UPDATE users SET balance = balance - $1 WHERE id = $2',
                        [charge.amount, customerId]
                    );

                    // Creditar ao comerciante (valor líquido)
                    await client.query(
                        'UPDATE users SET balance = balance + $1 WHERE id = $2',
                        [charge.net_amount, charge.merchant_id]
                    );

                    // Atualizar status da cobrança
                    await client.query(
                        `UPDATE pdv_charges SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`,
                        [charge.id]
                    );

                    // Registrar transação do cliente (débito)
                    await createTransaction(
                        client,
                        customerId.toString(),
                        'PDV_PAYMENT',
                        -parseFloat(charge.amount),
                        `Pagamento PDV para ${charge.merchant_name}`,
                        'APPROVED',
                        { chargeId: charge.id, merchantId: charge.merchant_id }
                    );

                    // Registrar transação do comerciante (crédito)
                    await createTransaction(
                        client,
                        charge.merchant_id.toString(),
                        'PDV_RECEIVE',
                        parseFloat(charge.net_amount),
                        `Venda PDV - Cliente ${customer.name}`,
                        'APPROVED',
                        { chargeId: charge.id, customerId, feeAmount: parseFloat(charge.fee_amount) }
                    );

                    // Taxa para o sistema
                    const feeAmount = parseFloat(charge.fee_amount);
                    await client.query(`
                        UPDATE system_config SET 
                            total_tax_reserve = total_tax_reserve + $1,
                            total_operational_reserve = total_operational_reserve + $2,
                            total_owner_profit = total_owner_profit + $3,
                            investment_reserve = investment_reserve + $4
                    `, [feeAmount * 0.25, feeAmount * 0.25, feeAmount * 0.25, feeAmount * 0.25]);
                }

                return { success: true, loanId };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            // Mensagem de retorno diferenciada
            const message = paymentType === 'CREDIT'
                ? `Compra de R$ ${parseFloat(charge.amount).toFixed(2)} parcelada em ${installments}x de R$ ${(totalWithInterest / installments).toFixed(2)} aprovada!`
                : `Pagamento de R$ ${parseFloat(charge.amount).toFixed(2)} confirmado com sucesso!`;

            return c.json({
                success: true,
                message,
                data: {
                    chargeId: charge.id,
                    amount: parseFloat(charge.amount),
                    merchantName: charge.merchant_name,
                    paymentType,
                    installments,
                    totalWithInterest,
                    installmentValue: totalWithInterest / installments,
                    loanId: result.data?.loanId || null
                }
            });

        } catch (error: any) {
            console.error('[PDV] Erro ao confirmar cobrança:', error);
            return c.json({ success: false, message: error.message || 'Erro ao confirmar' }, 500);
        }
    }

    /**
     * Histórico de vendas do comerciante
     */
    static async getMySales(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT c.*, u.name as customer_name
                FROM pdv_charges c
                JOIN users u ON c.customer_id = u.id
                WHERE c.merchant_id = $1
                ORDER BY c.created_at DESC
                LIMIT 100
            `, [user.id]);

            // Resumo
            const summaryRes = await pool.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'COMPLETED') as total_sales,
                    COALESCE(SUM(net_amount) FILTER (WHERE status = 'COMPLETED'), 0) as total_received,
                    COALESCE(SUM(net_amount) FILTER (WHERE status = 'COMPLETED' AND DATE(completed_at) = CURRENT_DATE), 0) as today_received
                FROM pdv_charges
                WHERE merchant_id = $1
            `, [user.id]);

            const summary = summaryRes.rows[0];

            return c.json({
                success: true,
                data: {
                    sales: result.rows.map(s => ({
                        id: s.id,
                        customerName: s.customer_name,
                        amount: parseFloat(s.amount),
                        feeAmount: parseFloat(s.fee_amount),
                        netAmount: parseFloat(s.net_amount),
                        status: s.status,
                        createdAt: s.created_at,
                        completedAt: s.completed_at
                    })),
                    summary: {
                        totalSales: parseInt(summary.total_sales),
                        totalReceived: parseFloat(summary.total_received),
                        todayReceived: parseFloat(summary.today_received)
                    }
                }
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Cancelar cobrança pendente
     */
    static async cancelCharge(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const chargeId = c.req.param('id');

            const result = await pool.query(`
                UPDATE pdv_charges 
                SET status = 'CANCELLED' 
                WHERE id = $1 AND merchant_id = $2 AND status = 'PENDING'
                RETURNING id
            `, [chargeId, user.id]);

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Cobrança não encontrada ou já processada.' }, 404);
            }

            return c.json({ success: true, message: 'Cobrança cancelada.' });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Tornar-se comerciante
     */
    static async becomeMerchant(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();
            const { merchantName } = body;

            if (!merchantName || merchantName.length < 3) {
                return c.json({ success: false, message: 'Nome do estabelecimento deve ter pelo menos 3 caracteres.' }, 400);
            }

            await pool.query(`
                UPDATE users 
                SET is_merchant = TRUE, merchant_name = $1, merchant_since = NOW() 
                WHERE id = $2
            `, [merchantName, user.id]);

            return c.json({
                success: true,
                message: `Parabéns! Agora você é comerciante Cred30 como "${merchantName}".`
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Simular parcelamento para um cliente
     */
    static async simulateCredit(c: Context) {
        try {
            const pool = getDbPool(c);
            const customerId = c.req.query('customerId');
            const amount = c.req.query('amount');

            if (!customerId || !amount) {
                return c.json({ success: false, message: 'customerId e amount são obrigatórios.' }, 400);
            }

            const parsedAmount = parseFloat(amount);
            if (parsedAmount < 10 || parsedAmount > 5000) {
                return c.json({ success: false, message: 'Valor deve ser entre R$ 10,00 e R$ 5.000,00.' }, 400);
            }

            // Buscar análise de crédito do cliente
            const creditAnalysis = await getCreditAnalysis(pool, customerId);

            if (!creditAnalysis.eligible) {
                return c.json({
                    success: false,
                    message: `Cliente não elegível: ${creditAnalysis.reason}`,
                    data: { eligible: false, reason: creditAnalysis.reason }
                }, 400);
            }

            // Verificar limite disponível
            const activeLoansRes = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) as total FROM loans 
                 WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING', 'PENDING')`,
                [customerId]
            );
            const activeDebt = parseFloat(activeLoansRes.rows[0].total);
            const remainingLimit = Math.max(0, creditAnalysis.limit - activeDebt);

            if (parsedAmount > remainingLimit) {
                return c.json({
                    success: false,
                    message: `Limite insuficiente. Disponível: R$ ${remainingLimit.toFixed(2)}`,
                    data: {
                        eligible: false,
                        limit: creditAnalysis.limit,
                        activeDebt,
                        remainingLimit,
                        requestedAmount: parsedAmount
                    }
                }, 400);
            }

            // Simular todas as opções de parcelamento (1x a 12x)
            const installmentOptions = [];
            const validGuarantees = [50, 60, 70, 80, 90, 100];

            for (let installments = 1; installments <= 12; installments++) {
                // Para cada número de parcelas, calcular com garantia de 100% (menor juros)
                const interestRate = calculateInterestRate(100);
                const total = parsedAmount * (1 + interestRate);
                const installmentValue = total / installments;

                installmentOptions.push({
                    installments,
                    interestRate: interestRate * 100, // em %
                    total,
                    installmentValue,
                    guaranteePercentage: 100
                });
            }

            // Taxa do comerciante
            const pdvFee = parsedAmount * PDV_FEE_RATE;
            const merchantReceives = parsedAmount - pdvFee;

            return c.json({
                success: true,
                data: {
                    eligible: true,
                    limit: creditAnalysis.limit,
                    activeDebt,
                    remainingLimit,
                    requestedAmount: parsedAmount,
                    pdvFee,
                    merchantReceives,
                    installmentOptions,
                    guaranteeOptions: validGuarantees.map(g => ({
                        percentage: g,
                        interestRate: calculateInterestRate(g) * 100
                    }))
                }
            });
        } catch (error: any) {
            console.error('[PDV] Erro na simulação:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Buscar detalhes de uma cobrança pendente (para QR Code / confirmação remota)
     * Rota pública - não requer autenticação
     */
    static async getChargeDetails(c: Context) {
        try {
            const pool = getDbPool(c);
            const chargeId = c.req.param('id');

            if (!chargeId) {
                return c.json({ success: false, message: 'ID da cobrança é obrigatório.' }, 400);
            }

            // Buscar cobrança com dados do comerciante e cliente
            const chargeRes = await pool.query(`
                SELECT 
                    c.id,
                    c.amount,
                    c.description,
                    c.confirmation_code,
                    c.status,
                    c.expires_at,
                    c.payment_type,
                    c.installments,
                    c.interest_rate,
                    c.total_with_interest,
                    c.customer_id,
                    m.name as merchant_name,
                    m.merchant_name as merchant_business_name,
                    cu.name as customer_name
                FROM pdv_charges c
                JOIN users m ON c.merchant_id = m.id
                JOIN users cu ON c.customer_id = cu.id
                WHERE c.id = $1
            `, [chargeId]);

            if (chargeRes.rows.length === 0) {
                return c.json({ success: false, message: 'Cobrança não encontrada.' }, 404);
            }

            const charge = chargeRes.rows[0];

            // Verificar se ainda está pendente e não expirada
            if (charge.status !== 'PENDING') {
                return c.json({
                    success: false,
                    message: charge.status === 'COMPLETED' ? 'Esta cobrança já foi paga.' : 'Cobrança cancelada ou expirada.',
                    data: { status: charge.status }
                }, 400);
            }

            const expiresAt = new Date(charge.expires_at);
            if (expiresAt < new Date()) {
                return c.json({ success: false, message: 'Esta cobrança expirou.' }, 400);
            }

            // Calcular tempo restante
            const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

            const paymentType = charge.payment_type || 'BALANCE';
            const installments = parseInt(charge.installments) || 1;
            const totalWithInterest = parseFloat(charge.total_with_interest) || parseFloat(charge.amount);

            return c.json({
                success: true,
                data: {
                    chargeId: charge.id,
                    customerId: charge.customer_id,
                    customerName: charge.customer_name,
                    merchantName: charge.merchant_business_name || charge.merchant_name,
                    description: charge.description,
                    confirmationCode: charge.confirmation_code,
                    expiresAt: charge.expires_at,
                    remainingSeconds,
                    // Dados financeiros
                    amount: parseFloat(charge.amount),
                    paymentType,
                    installments,
                    interestRate: parseFloat(charge.interest_rate) * 100 || 0,
                    totalWithInterest,
                    installmentValue: installments > 1 ? totalWithInterest / installments : parseFloat(charge.amount)
                }
            });
        } catch (error: any) {
            console.error('[PDV] Erro ao buscar detalhes:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
