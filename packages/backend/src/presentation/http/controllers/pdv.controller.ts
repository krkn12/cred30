import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, createTransaction } from '../../../domain/services/transaction.service';
import { UserContext } from '../../../shared/types/hono.types';
import { PoolClient } from 'pg';

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
     * Comerciante inicia uma cobrança
     */
    static async createCharge(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();
            const { customerId, amount, description } = body;

            if (!customerId || !amount) {
                return c.json({ success: false, message: 'ID do cliente e valor são obrigatórios.' }, 400);
            }

            const parsedAmount = parseFloat(amount);
            if (parsedAmount < 1) {
                return c.json({ success: false, message: 'Valor mínimo é R$ 1,00.' }, 400);
            }

            if (parsedAmount > 5000) {
                return c.json({ success: false, message: 'Valor máximo por transação é R$ 5.000,00.' }, 400);
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

            // Verificar saldo do cliente
            if (parseFloat(customer.balance) < parsedAmount) {
                return c.json({
                    success: false,
                    message: `Cliente não tem saldo suficiente. Saldo atual: R$ ${parseFloat(customer.balance).toFixed(2)}`
                }, 400);
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
                INSERT INTO pdv_charges (merchant_id, customer_id, amount, description, confirmation_code, fee_amount, net_amount, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, confirmation_code, expires_at
            `, [user.id, customerId, parsedAmount, description || 'Pagamento PDV', code, feeAmount, netAmount, expiresAt]);

            const charge = chargeRes.rows[0];

            // Buscar dados do comerciante para mostrar ao cliente
            const merchantRes = await pool.query(
                'SELECT name, merchant_name, pix_key FROM users WHERE id = $1',
                [user.id]
            );
            const merchant = merchantRes.rows[0];

            return c.json({
                success: true,
                message: 'Cobrança criada! Mostre a tela para o cliente confirmar.',
                data: {
                    chargeId: charge.id,
                    confirmationCode: charge.confirmation_code,
                    expiresAt: charge.expires_at,
                    amount: parsedAmount,
                    feeAmount,
                    netAmount,
                    customer: {
                        id: customer.id,
                        name: customer.name
                    },
                    merchant: {
                        name: merchant.merchant_name || merchant.name,
                        pixKey: merchant.pix_key ? `****${merchant.pix_key.slice(-4)}` : null
                    }
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

            // Buscar cobrança pendente com esse código
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

            // Verificar saldo novamente
            if (parseFloat(customer.balance) < parseFloat(charge.amount)) {
                return c.json({ success: false, message: 'Saldo insuficiente.' }, 400);
            }

            // Executar transação
            const result = await executeInTransaction(pool, async (client: PoolClient) => {
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

                return { success: true };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            return c.json({
                success: true,
                message: `Pagamento de R$ ${parseFloat(charge.amount).toFixed(2)} confirmado com sucesso!`,
                data: {
                    chargeId: charge.id,
                    amount: parseFloat(charge.amount),
                    merchantName: charge.merchant_name
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
}
