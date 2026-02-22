import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, updateUserBalance, createTransaction, lockSystemConfig, incrementSystemReserves } from '../../../domain/services/transaction.service';
import { UserContext } from '../../../shared/types/hono.types';
import {
    PDV_PLANS,
    PDV_FEE_TAX_SHARE,
    PDV_FEE_OPERATIONAL_SHARE,
    PDV_FEE_OWNER_SHARE,
    PDV_FEE_STABILITY_SHARE,
    PDV_FEE_COTISTA_SHARE,
    PDV_FEE_CORPORATE_SHARE,
    PDV_TRANSACTION_FEE_RATE,
    PLATFORM_FEE_TAX_SHARE,
    PLATFORM_FEE_OPERATIONAL_SHARE,
    PLATFORM_FEE_OWNER_SHARE,
    PLATFORM_FEE_INVESTMENT_SHARE,
    PLATFORM_FEE_CORPORATE_SHARE,
    LOAN_INTEREST_RATE
} from '../../../shared/constants/business.constants';
import { getCreditAnalysis } from '../../../application/services/credit-analysis.service';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

// Schemas de Validação
const subscribePdvSchema = z.object({
    plan: z.enum(['BASIC', 'PRO', 'ENTERPRISE'])
});

const registerDeviceSchema = z.object({
    deviceName: z.string().min(2).max(100),
    deviceType: z.enum(['DESKTOP', 'TABLET', 'MOBILE']).optional().default('DESKTOP')
});

const createProductSchema = z.object({
    name: z.string().min(2).max(200),
    barcode: z.string().optional(),
    sku: z.string().optional(),
    price: z.coerce.number().min(0.01),
    costPrice: z.coerce.number().min(0).optional(),
    stock: z.coerce.number().min(0).optional().default(0),
    minStock: z.coerce.number().min(0).optional().default(5),
    category: z.string().optional(),
    unit: z.string().optional().default('UN'),
    taxNcm: z.string().optional(),
    imageUrl: z.string().optional()
});

const createSaleSchema = z.object({
    items: z.array(z.object({
        productId: z.string().uuid().optional(),
        productName: z.string(),
        productBarcode: z.string().optional(),
        quantity: z.coerce.number().min(0.001),
        unitPrice: z.coerce.number().min(0),
        discount: z.coerce.number().min(0).optional().default(0)
    })).min(1),
    discount: z.coerce.number().min(0).optional().default(0),
    paymentMethod: z.enum(['PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'CRED30', 'CRED30_SALDO', 'CRED30_CREDITO']),
    receivedAmount: z.coerce.number().min(0).optional(),
    customerId: z.string().optional(), // ID do cliente Cred30 (para pagamento via saldo/crédito)
    customerCpf: z.string().optional(),
    customerName: z.string().optional(),
    installments: z.coerce.number().int().min(1).max(12).optional().default(1), // Parcelas para crédito Cred30
    notes: z.string().optional()
});

export class PdvController {

    /**
     * Listar planos disponíveis
     */
    static async getPlans(c: Context) {
        return c.json({
            success: true,
            plans: Object.values(PDV_PLANS)
        });
    }

    /**
     * Verificar status da assinatura do usuário
     */
    static async getSubscriptionStatus(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT s.*, 
                       (SELECT COUNT(*) FROM pdv_devices WHERE subscription_id = s.id AND is_active = TRUE) as active_devices
                FROM pdv_subscriptions s
                WHERE s.user_id = $1 AND s.status = 'ACTIVE'
                ORDER BY s.created_at DESC
                LIMIT 1
            `, [user.id]);

            if (result.rows.length === 0) {
                return c.json({
                    success: true,
                    hasSubscription: false,
                    subscription: null
                });
            }

            const sub = result.rows[0];
            const planInfo = Object.values(PDV_PLANS).find(p => p.code === sub.plan);

            return c.json({
                success: true,
                hasSubscription: true,
                subscription: {
                    id: sub.id,
                    plan: sub.plan,
                    planName: planInfo?.name || sub.plan,
                    maxDevices: sub.max_devices,
                    activeDevices: parseInt(sub.active_devices),
                    priceMonthly: parseFloat(sub.price_monthly),
                    status: sub.status,
                    expiresAt: sub.expires_at,
                    autoRenew: sub.auto_renew
                }
            });
        } catch (error: any) {
            console.error('[PDV] Erro ao buscar assinatura:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Assinar plano PDV
     */
    static async subscribe(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();

            const parseResult = subscribePdvSchema.safeParse(body);
            if (!parseResult.success) {
                return c.json({ success: false, message: 'Plano inválido.' }, 400);
            }

            const { plan } = parseResult.data;
            const planInfo = PDV_PLANS[plan];

            // Verificar se usuário é vendedor
            const sellerCheck = await pool.query(
                'SELECT is_seller, seller_status FROM users WHERE id = $1',
                [user.id]
            );

            if (!sellerCheck.rows[0]?.is_seller || sellerCheck.rows[0]?.seller_status !== 'approved') {
                return c.json({
                    success: false,
                    message: 'Você precisa ser um vendedor aprovado para assinar o PDV.'
                }, 403);
            }

            // Verificar se já tem assinatura ativa
            const existingCheck = await pool.query(
                'SELECT id FROM pdv_subscriptions WHERE user_id = $1 AND status = $2',
                [user.id, 'ACTIVE']
            );

            if (existingCheck.rows.length > 0) {
                return c.json({
                    success: false,
                    message: 'Você já possui uma assinatura PDV ativa. Cancele a atual para trocar de plano.'
                }, 400);
            }

            // Processar pagamento e criar assinatura
            const result = await executeInTransaction(pool, async (client: any) => {
                // Verificar saldo
                const balanceRes = await client.query(
                    'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
                    [user.id]
                );
                const balance = parseFloat(balanceRes.rows[0].balance);

                if (balance < planInfo.price) {
                    throw new Error(`Saldo insuficiente. Você tem R$ ${balance.toFixed(2)}, mas precisa de R$ ${planInfo.price.toFixed(2)}.`);
                }

                // Descontar saldo (updateUserBalance com 'debit' espera valor positivo)
                await updateUserBalance(client, user.id, planInfo.price, 'debit');

                // Distribuir para os potes
                await lockSystemConfig(client);

                const taxAmount = planInfo.price * PDV_FEE_TAX_SHARE;
                const operationalAmount = planInfo.price * PDV_FEE_OPERATIONAL_SHARE;
                const ownerAmount = planInfo.price * PDV_FEE_OWNER_SHARE;
                const stabilityAmount = planInfo.price * PDV_FEE_STABILITY_SHARE;
                const cotistaAmount = planInfo.price * PDV_FEE_COTISTA_SHARE;
                const corporateAmount = planInfo.price * PDV_FEE_CORPORATE_SHARE;

                await incrementSystemReserves(client, {
                    tax: taxAmount,
                    operational: operationalAmount,
                    owner: ownerAmount,
                    mutual: stabilityAmount,
                    profitPool: cotistaAmount,
                    corporate: corporateAmount
                });

                // Criar assinatura
                const expiresAt = new Date();
                expiresAt.setMonth(expiresAt.getMonth() + 1);

                const subResult = await client.query(`
                    INSERT INTO pdv_subscriptions (user_id, plan, max_devices, price_monthly, expires_at, last_payment_at)
                    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                    RETURNING id
                `, [user.id, planInfo.code, planInfo.maxDevices, planInfo.price, expiresAt]);

                const subscriptionId = subResult.rows[0].id;

                // Registrar pagamento
                await client.query(`
                    INSERT INTO pdv_subscription_payments 
                    (subscription_id, amount, tax_amount, operational_amount, owner_amount, stability_amount, cotista_amount, corporate_amount)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [subscriptionId, planInfo.price, taxAmount, operationalAmount, ownerAmount, stabilityAmount, cotistaAmount, corporateAmount]);

                // Registrar transação
                // Registrar transação
                await createTransaction(
                    client,
                    user.id,
                    'PDV_SUBSCRIPTION',
                    -planInfo.price,
                    `Assinatura PDV - Plano ${planInfo.name}`,
                    'COMPLETED',
                    { subscriptionId, plan: planInfo.code }
                );

                return { subscriptionId, expiresAt };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error || 'Erro ao processar assinatura.' }, 400);
            }

            return c.json({
                success: true,
                message: `Assinatura ${planInfo.name} ativada com sucesso!`,
                subscription: {
                    id: result.data!.subscriptionId,
                    plan: planInfo.code,
                    planName: planInfo.name,
                    maxDevices: planInfo.maxDevices,
                    expiresAt: result.data!.expiresAt
                }
            });

        } catch (error: any) {
            console.error('[PDV] Erro ao assinar:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Cancelar assinatura
     */
    static async cancelSubscription(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(`
                UPDATE pdv_subscriptions 
                SET status = 'CANCELLED', auto_renew = FALSE, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1 AND status = 'ACTIVE'
                RETURNING id
            `, [user.id]);

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Nenhuma assinatura ativa encontrada.' }, 404);
            }

            return c.json({
                success: true,
                message: 'Assinatura cancelada. Você ainda terá acesso até o fim do período pago.'
            });

        } catch (error: any) {
            console.error('[PDV] Erro ao cancelar:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Registrar novo dispositivo/máquina
     */
    static async registerDevice(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();

            const parseResult = registerDeviceSchema.safeParse(body);
            if (!parseResult.success) {
                return c.json({ success: false, message: 'Dados inválidos.' }, 400);
            }

            const { deviceName, deviceType } = parseResult.data;

            // Buscar assinatura ativa
            const subResult = await pool.query(`
                SELECT s.*, 
                       (SELECT COUNT(*) FROM pdv_devices WHERE subscription_id = s.id AND is_active = TRUE) as active_devices
                FROM pdv_subscriptions s
                WHERE s.user_id = $1 AND s.status = 'ACTIVE'
            `, [user.id]);

            if (subResult.rows.length === 0) {
                return c.json({ success: false, message: 'Você não possui assinatura PDV ativa.' }, 403);
            }

            const sub = subResult.rows[0];
            const activeDevices = parseInt(sub.active_devices);

            if (activeDevices >= sub.max_devices) {
                return c.json({
                    success: false,
                    message: `Limite de dispositivos atingido (${sub.max_devices}). Faça upgrade do plano ou desative um dispositivo.`
                }, 400);
            }

            // Gerar token único para o dispositivo
            const deviceToken = jwt.sign(
                {
                    userId: user.id,
                    subscriptionId: sub.id,
                    deviceId: uuidv4(),
                    type: 'pdv_device'
                },
                process.env.JWT_SECRET || 'fallback-secret',
                { expiresIn: '365d' }
            );

            // Registrar dispositivo
            const deviceResult = await pool.query(`
                INSERT INTO pdv_devices (subscription_id, device_name, device_token, device_type, last_seen_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                RETURNING id
            `, [sub.id, deviceName, deviceToken, deviceType]);

            return c.json({
                success: true,
                message: 'Dispositivo registrado com sucesso!',
                device: {
                    id: deviceResult.rows[0].id,
                    name: deviceName,
                    type: deviceType,
                    token: deviceToken
                }
            });

        } catch (error: any) {
            console.error('[PDV] Erro ao registrar dispositivo:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Listar dispositivos
     */
    static async getDevices(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT d.id, d.device_name, d.device_type, d.last_seen_at, d.is_active, d.created_at
                FROM pdv_devices d
                JOIN pdv_subscriptions s ON d.subscription_id = s.id
                WHERE s.user_id = $1
                ORDER BY d.created_at DESC
            `, [user.id]);

            return c.json({
                success: true,
                devices: result.rows.map(d => ({
                    id: d.id,
                    name: d.device_name,
                    type: d.device_type,
                    lastSeen: d.last_seen_at,
                    isActive: d.is_active,
                    createdAt: d.created_at
                }))
            });

        } catch (error: any) {
            console.error('[PDV] Erro ao listar dispositivos:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Desativar dispositivo
     */
    static async deactivateDevice(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const deviceId = c.req.param('deviceId');

            const result = await pool.query(`
                UPDATE pdv_devices d
                SET is_active = FALSE
                FROM pdv_subscriptions s
                WHERE d.subscription_id = s.id
                AND s.user_id = $1
                AND d.id = $2
                RETURNING d.id
            `, [user.id, deviceId]);

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Dispositivo não encontrado.' }, 404);
            }

            return c.json({ success: true, message: 'Dispositivo desativado.' });

        } catch (error: any) {
            console.error('[PDV] Erro ao desativar dispositivo:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    // ========================================
    // PRODUTOS
    // ========================================

    /**
     * Listar produtos do PDV
     */
    static async getProducts(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT * FROM pdv_products
                WHERE user_id = $1 AND is_active = TRUE
                ORDER BY name ASC
            `, [user.id]);

            return c.json({
                success: true,
                products: result.rows.map(p => ({
                    id: p.id,
                    name: p.name,
                    barcode: p.barcode,
                    sku: p.sku,
                    price: parseFloat(p.price),
                    costPrice: p.cost_price ? parseFloat(p.cost_price) : null,
                    stock: parseFloat(p.stock),
                    minStock: parseFloat(p.min_stock),
                    category: p.category,
                    unit: p.unit,
                    imageUrl: p.image_url
                }))
            });

        } catch (error: any) {
            console.error('[PDV] Erro ao listar produtos:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Criar produto
     */
    static async createProduct(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();

            const parseResult = createProductSchema.safeParse(body);
            if (!parseResult.success) {
                return c.json({ success: false, message: 'Dados inválidos.', errors: parseResult.error.errors }, 400);
            }

            const data = parseResult.data;

            const result = await pool.query(`
                INSERT INTO pdv_products (user_id, name, barcode, sku, price, cost_price, stock, min_stock, category, unit, tax_ncm, image_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `, [
                user.id, data.name, data.barcode, data.sku, data.price, data.costPrice,
                data.stock, data.minStock, data.category, data.unit, data.taxNcm, data.imageUrl
            ]);

            return c.json({
                success: true,
                message: 'Produto criado com sucesso!',
                productId: result.rows[0].id
            });

        } catch (error: any) {
            console.error('[PDV] Erro ao criar produto:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Atualizar produto existente
     */
    static async updateProduct(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const productId = c.req.param('productId');
            const body = await c.req.json();

            // Verificar se o produto pertence ao usuário
            const ownerCheck = await pool.query(
                'SELECT id FROM pdv_products WHERE id = $1 AND user_id = $2',
                [productId, user.id]
            );

            if (ownerCheck.rows.length === 0) {
                return c.json({ success: false, message: 'Produto não encontrado.' }, 404);
            }

            // Construir query dinâmica com campos opcionais
            const updates: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (body.name !== undefined) { updates.push(`name = $${paramIndex++}`); values.push(body.name); }
            if (body.price !== undefined) { updates.push(`price = $${paramIndex++}`); values.push(body.price); }
            if (body.stock !== undefined) { updates.push(`stock = $${paramIndex++}`); values.push(body.stock); }
            if (body.sku !== undefined) { updates.push(`sku = $${paramIndex++}`); values.push(body.sku || null); }
            if (body.barcode !== undefined) { updates.push(`barcode = $${paramIndex++}`); values.push(body.barcode || null); }
            if (body.costPrice !== undefined) { updates.push(`cost_price = $${paramIndex++}`); values.push(body.costPrice || null); }
            if (body.minStock !== undefined) { updates.push(`min_stock = $${paramIndex++}`); values.push(body.minStock); }
            if (body.category !== undefined) { updates.push(`category = $${paramIndex++}`); values.push(body.category || null); }
            if (body.unit !== undefined) { updates.push(`unit = $${paramIndex++}`); values.push(body.unit || null); }

            if (updates.length === 0) {
                return c.json({ success: false, message: 'Nenhum campo para atualizar.' }, 400);
            }

            updates.push(`updated_at = NOW()`);
            values.push(productId);

            await pool.query(
                `UPDATE pdv_products SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
                values
            );

            return c.json({ success: true, message: 'Produto atualizado com sucesso!' });

        } catch (error: any) {
            console.error('[PDV] Erro ao atualizar produto:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Excluir produto (soft delete)
     */
    static async deleteProduct(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const productId = c.req.param('productId');

            // Verificar se o produto pertence ao usuário
            const ownerCheck = await pool.query(
                'SELECT id FROM pdv_products WHERE id = $1 AND user_id = $2',
                [productId, user.id]
            );

            if (ownerCheck.rows.length === 0) {
                return c.json({ success: false, message: 'Produto não encontrado.' }, 404);
            }

            // Soft delete — manter registro para histórico de vendas
            await pool.query(
                'UPDATE pdv_products SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
                [productId]
            );

            return c.json({ success: true, message: 'Produto removido com sucesso!' });

        } catch (error: any) {
            console.error('[PDV] Erro ao excluir produto:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    // ========================================
    // VENDAS
    // ========================================

    /**
     * Registrar venda
     */
    static async createSale(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();

            const parseResult = createSaleSchema.safeParse(body);
            if (!parseResult.success) {
                return c.json({ success: false, message: 'Dados inválidos.', errors: parseResult.error.errors }, 400);
            }

            const data = parseResult.data;

            const result = await executeInTransaction(pool, async (client: any) => {
                // Calcular totais
                let subtotal = 0;
                const processedItems = [];

                for (const item of data.items) {
                    const itemTotal = (item.quantity * item.unitPrice) - (item.discount || 0);
                    subtotal += itemTotal;
                    processedItems.push({
                        ...item,
                        total: itemTotal
                    });

                    // Baixar estoque se tiver productId
                    if (item.productId) {
                        await client.query(`
                            UPDATE pdv_products 
                            SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP
                            WHERE id = $2 AND user_id = $3
                        `, [item.quantity, item.productId, user.id]);
                    }
                }

                const total = subtotal - (data.discount || 0);
                const changeAmount = data.receivedAmount ? Math.max(0, data.receivedAmount - total) : 0;

                // Buscar device_id se estiver autenticado via token de dispositivo
                const deviceId = null;
                // TODO: Implementar autenticação por device token

                // Obter próximo número de venda
                const saleNumberRes = await client.query(
                    'SELECT get_next_sale_number($1) as num',
                    [user.id]
                );
                const saleNumber = saleNumberRes.rows[0].num;

                // Criar venda
                const saleResult = await client.query(`
                    INSERT INTO pdv_sales 
                    (user_id, device_id, sale_number, subtotal, discount, total, payment_method, received_amount, change_amount, customer_cpf, customer_name, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    RETURNING id
                `, [
                    user.id, deviceId, saleNumber, subtotal, data.discount, total,
                    data.paymentMethod, data.receivedAmount, changeAmount,
                    data.customerCpf, data.customerName, data.notes
                ]);

                const saleId = saleResult.rows[0].id;

                // Inserir itens
                for (const item of processedItems) {
                    await client.query(`
                        INSERT INTO pdv_sale_items 
                        (sale_id, product_id, product_name, product_barcode, quantity, unit_price, discount, total)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [
                        saleId, item.productId || null, item.productName, item.productBarcode,
                        item.quantity, item.unitPrice, item.discount, item.total
                    ]);
                }

                // --- PROCESSAMENTO DE PAGAMENTO CRED30 ---
                let transactionFee = 0;
                let loanCreated = false;

                if (data.paymentMethod === 'CRED30_SALDO' || data.paymentMethod === 'CRED30_CREDITO') {
                    if (!data.customerId) {
                        throw new Error('ID do cliente é obrigatório para pagamento via Cred30.');
                    }

                    // Verificar se o cliente existe
                    const customerCheck = await client.query(
                        'SELECT id, name, balance, score FROM users WHERE id = $1',
                        [data.customerId]
                    );
                    if (customerCheck.rows.length === 0) {
                        throw new Error('Cliente não encontrado.');
                    }
                    const customer = customerCheck.rows[0];

                    // Calcular taxa do comerciante (6%)
                    transactionFee = Math.round(total * PDV_TRANSACTION_FEE_RATE * 100) / 100;
                    const merchantReceives = Math.round((total - transactionFee) * 100) / 100;

                    if (data.paymentMethod === 'CRED30_SALDO') {
                        // === PAGAMENTO VIA SALDO ===
                        const customerBalance = parseFloat(customer.balance) || 0;
                        if (customerBalance < total) {
                            throw new Error(`Saldo insuficiente. Cliente tem R$ ${customerBalance.toFixed(2)} mas a venda é R$ ${total.toFixed(2)}.`);
                        }

                        // Debitar saldo do cliente
                        await client.query(
                            'UPDATE users SET balance = balance - $1 WHERE id = $2',
                            [total, data.customerId]
                        );

                        // Creditar saldo no comerciante (menos taxa)
                        await client.query(
                            'UPDATE users SET balance = balance + $1 WHERE id = $2',
                            [merchantReceives, user.id]
                        );

                        // Registrar transação do cliente (débito)
                        await client.query(`
                            INSERT INTO transactions (user_id, type, amount, description, metadata)
                            VALUES ($1, 'PDV_PURCHASE', $2, $3, $4)
                        `, [
                            data.customerId,
                            -total,
                            `Compra PDV #${saleNumber} - ${data.customerName || 'Loja'}`,
                            JSON.stringify({ saleId, saleNumber, merchantId: user.id, method: 'SALDO' })
                        ]);

                        // Registrar transação do comerciante (crédito)
                        await client.query(`
                            INSERT INTO transactions (user_id, type, amount, description, metadata)
                            VALUES ($1, 'PDV_SALE_INCOME', $2, $3, $4)
                        `, [
                            user.id,
                            merchantReceives,
                            `Venda PDV #${saleNumber} via Saldo Cred30 (taxa: R$ ${transactionFee.toFixed(2)})`,
                            JSON.stringify({ saleId, saleNumber, customerId: data.customerId, fee: transactionFee, method: 'SALDO' })
                        ]);

                    } else {
                        // === PAGAMENTO VIA CRÉDITO (EMPRÉSTIMO AUTOMÁTICO) ===
                        // Verificar elegibilidade
                        const creditAnalysis = await getCreditAnalysis(client, data.customerId.toString());
                        if (!creditAnalysis.eligible) {
                            throw new Error('Cliente não possui limite de crédito disponível.');
                        }

                        const availableCredit = creditAnalysis.details?.availableLimit || 0;
                        if (availableCredit < total) {
                            throw new Error(`Limite de crédito insuficiente. Disponível: R$ ${availableCredit.toFixed(2)}, necessário: R$ ${total.toFixed(2)}.`);
                        }

                        // Criar empréstimo automático para o cliente
                        const installments = data.installments || 1;
                        const interestRate = LOAN_INTEREST_RATE; // 20% padrão
                        const totalRepayment = Math.round(total * (1 + interestRate) * 100) / 100;
                        const installmentAmount = Math.round((totalRepayment / installments) * 100) / 100;

                        const loanRes = await client.query(`
                            INSERT INTO loans (user_id, amount, interest_rate, total_repayment, installments, status, metadata)
                            VALUES ($1, $2, $3, $4, $5, 'APPROVED', $6)
                            RETURNING id
                        `, [
                            data.customerId,
                            total,
                            interestRate,
                            totalRepayment,
                            installments,
                            JSON.stringify({
                                origin: 'PDV_CREDIT',
                                saleId,
                                saleNumber,
                                merchantId: user.id,
                                guaranteePercentage: 100
                            })
                        ]);
                        const loanId = loanRes.rows[0].id;

                        // Criar parcelas do empréstimo
                        for (let i = 1; i <= installments; i++) {
                            const dueDate = new Date();
                            dueDate.setMonth(dueDate.getMonth() + i);
                            await client.query(`
                                INSERT INTO loan_installments (loan_id, installment_number, amount, due_date, status)
                                VALUES ($1, $2, $3, $4, 'PENDING')
                            `, [loanId, i, installmentAmount, dueDate.toISOString()]);
                        }

                        // Creditar saldo no comerciante (menos taxa)
                        await client.query(
                            'UPDATE users SET balance = balance + $1 WHERE id = $2',
                            [merchantReceives, user.id]
                        );

                        // Registrar transação do comerciante (crédito)
                        await client.query(`
                            INSERT INTO transactions (user_id, type, amount, description, metadata)
                            VALUES ($1, 'PDV_SALE_INCOME', $2, $3, $4)
                        `, [
                            user.id,
                            merchantReceives,
                            `Venda PDV #${saleNumber} via Crédito Cred30 ${installments}x (taxa: R$ ${transactionFee.toFixed(2)})`,
                            JSON.stringify({ saleId, saleNumber, customerId: data.customerId, loanId, fee: transactionFee, method: 'CREDITO', installments })
                        ]);

                        // CORREÇÃO CRÍTICA (Fluxo de Caixa Contábil):
                        // O dinheiro cedido como empréstimo pelo sistema precisa ser debitado do fundo de investimentos
                        await incrementSystemReserves(client, {
                            investment: -total
                        });

                        loanCreated = true;
                    }

                    // Distribuir taxa nos pools da plataforma
                    if (transactionFee > 0) {
                        const config = await lockSystemConfig(client);
                        const taxShare = Math.round(transactionFee * PLATFORM_FEE_TAX_SHARE * 100) / 100;
                        const opShare = Math.round(transactionFee * PLATFORM_FEE_OPERATIONAL_SHARE * 100) / 100;
                        const ownerShare = Math.round(transactionFee * PLATFORM_FEE_OWNER_SHARE * 100) / 100;
                        const investShare = Math.round(transactionFee * PLATFORM_FEE_INVESTMENT_SHARE * 100) / 100;
                        const corpShare = Math.round(transactionFee * PLATFORM_FEE_CORPORATE_SHARE * 100) / 100;

                        await incrementSystemReserves(client, {
                            tax: taxShare,
                            operational: opShare,
                            owner: ownerShare,
                            investment: investShare,
                            corporate: corpShare
                        });

                        // Registrar transação de taxa
                        await client.query(`
                            INSERT INTO transactions (user_id, type, amount, description, metadata)
                            VALUES ($1, 'PDV_TRANSACTION_FEE', $2, $3, $4)
                        `, [
                            user.id,
                            -transactionFee,
                            `Taxa PDV transação #${saleNumber} (${(PDV_TRANSACTION_FEE_RATE * 100).toFixed(0)}%)`,
                            JSON.stringify({ saleId, saleNumber, feeRate: PDV_TRANSACTION_FEE_RATE })
                        ]);
                    }
                }

                return { saleId, saleNumber, total, changeAmount, transactionFee, loanCreated };
            });

            return c.json({
                success: true,
                message: 'Venda registrada!',
                sale: {
                    id: result.data!.saleId,
                    number: result.data!.saleNumber,
                    total: result.data!.total,
                    change: result.data!.changeAmount,
                    transactionFee: result.data!.transactionFee || 0,
                    loanCreated: result.data!.loanCreated || false
                }
            });

        } catch (error: any) {
            console.error('[PDV] Erro ao criar venda:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Listar vendas do dia
     */
    static async getSales(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const startDate = c.req.query('startDate') || new Date().toISOString().split('T')[0];
            const endDate = c.req.query('endDate') || startDate;

            const result = await pool.query(`
                SELECT s.*, 
                       (SELECT json_agg(json_build_object(
                           'productName', i.product_name,
                           'quantity', i.quantity,
                           'unitPrice', i.unit_price,
                           'total', i.total
                       )) FROM pdv_sale_items i WHERE i.sale_id = s.id) as items
                FROM pdv_sales s
                WHERE s.user_id = $1
                AND s.created_at::date BETWEEN $2 AND $3
                ORDER BY s.created_at DESC
            `, [user.id, startDate, endDate]);

            // Totais
            const totals = {
                count: result.rows.length,
                total: result.rows.reduce((sum, s) => sum + parseFloat(s.total), 0),
                byPaymentMethod: {} as Record<string, number>
            };

            result.rows.forEach(s => {
                const method = s.payment_method || 'OUTROS';
                totals.byPaymentMethod[method] = (totals.byPaymentMethod[method] || 0) + parseFloat(s.total);
            });

            return c.json({
                success: true,
                sales: result.rows.map(s => ({
                    id: s.id,
                    number: s.sale_number,
                    total: parseFloat(s.total),
                    discount: parseFloat(s.discount),
                    paymentMethod: s.payment_method,
                    customerName: s.customer_name,
                    createdAt: s.created_at,
                    items: s.items || []
                })),
                totals
            });

        } catch (error: any) {
            console.error('[PDV] Erro ao listar vendas:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Buscar cliente Cred30 por telefone (para pagamento via plataforma)
     */
    static async lookupCustomer(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();

            const phone = body.phone?.replace(/\D/g, '');
            if (!phone || phone.length < 10) {
                return c.json({ success: false, message: 'Telefone inválido. Informe pelo menos 10 dígitos.' }, 400);
            }

            // Buscar cliente pelo telefone
            const customerRes = await pool.query(
                `SELECT id, name, balance, score FROM users WHERE REPLACE(REPLACE(REPLACE(phone, '(', ''), ')', ''), '-', '') LIKE '%' || $1 || '%' LIMIT 1`,
                [phone]
            );

            if (customerRes.rows.length === 0) {
                return c.json({ success: true, found: false, message: 'Cliente não encontrado na plataforma.' });
            }

            const customer = customerRes.rows[0];

            // Não permitir que o comerciante se busque como cliente
            if (customer.id.toString() === user.id.toString()) {
                return c.json({ success: false, message: 'Você não pode pagar para si mesmo.' }, 400);
            }

            // Obter análise de crédito do cliente
            let creditInfo = { limit: 0, availableCredit: 0, eligible: false };
            try {
                const analysis = await getCreditAnalysis(pool, customer.id.toString());
                creditInfo = {
                    limit: analysis.limit || 0,
                    availableCredit: analysis.details?.availableLimit || 0,
                    eligible: analysis.eligible || false
                };
            } catch (e) {
                // Se falhar a análise de crédito, continua sem crédito
                console.warn('[PDV] Falha ao analisar crédito do cliente:', e);
            }

            return c.json({
                success: true,
                found: true,
                customer: {
                    id: customer.id,
                    name: customer.name,
                    balance: parseFloat(customer.balance) || 0,
                    creditLimit: creditInfo.limit,
                    availableCredit: creditInfo.availableCredit,
                    creditEligible: creditInfo.eligible
                },
                transactionFeeRate: PDV_TRANSACTION_FEE_RATE // Informar taxa ao frontend
            });

        } catch (error: any) {
            console.error('[PDV] Erro ao buscar cliente:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
