import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, updateUserBalance, createTransaction, lockSystemConfig } from '../../../domain/services/transaction.service';
import { UserContext } from '../../../shared/types/hono.types';
import {
    PDV_PLANS,
    PDV_FEE_TAX_SHARE,
    PDV_FEE_OPERATIONAL_SHARE,
    PDV_FEE_OWNER_SHARE,
    PDV_FEE_STABILITY_SHARE,
    PDV_FEE_COTISTA_SHARE,
    PDV_FEE_CORPORATE_SHARE
} from '../../../shared/constants/business.constants';
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
    paymentMethod: z.enum(['PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'CRED30']),
    receivedAmount: z.coerce.number().min(0).optional(),
    customerCpf: z.string().optional(),
    customerName: z.string().optional(),
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

                // Descontar saldo
                await updateUserBalance(client, user.id, -planInfo.price);

                // Distribuir para os potes
                await lockSystemConfig(client);

                const taxAmount = planInfo.price * PDV_FEE_TAX_SHARE;
                const operationalAmount = planInfo.price * PDV_FEE_OPERATIONAL_SHARE;
                const ownerAmount = planInfo.price * PDV_FEE_OWNER_SHARE;
                const stabilityAmount = planInfo.price * PDV_FEE_STABILITY_SHARE;
                const cotistaAmount = planInfo.price * PDV_FEE_COTISTA_SHARE;
                const corporateAmount = planInfo.price * PDV_FEE_CORPORATE_SHARE;

                await client.query(`
                    UPDATE system_config SET
                        total_tax_reserve = total_tax_reserve + $1,
                        total_operational_reserve = total_operational_reserve + $2,
                        total_owner_profit = total_owner_profit + $3,
                        mutual_reserve = COALESCE(mutual_reserve, 0) + $4,
                        profit_pool = profit_pool + $5,
                        total_corporate_investment_reserve = COALESCE(total_corporate_investment_reserve, 0) + $6
                `, [taxAmount, operationalAmount, ownerAmount, stabilityAmount, cotistaAmount, corporateAmount]);

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
                let deviceId = null;
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

                return { saleId, saleNumber, total, changeAmount };
            });

            return c.json({
                success: true,
                message: 'Venda registrada!',
                sale: {
                    id: result.data!.saleId,
                    number: result.data!.saleNumber,
                    total: result.data!.total,
                    change: result.data!.changeAmount
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
}
