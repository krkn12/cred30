import { Hono, Context } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';
import { LOGISTICS_SUSTAINABILITY_FEE_RATE } from '../../../shared/constants/business.constants';
import { UserContext } from '../../../shared/types/hono.types';

const logisticsRoutes = new Hono();

/**
 * GET /logistics/available
 * Lista entregas disponíveis para entregadores
 */
logisticsRoutes.get('/available', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        // Buscar contagem de entregas concluídas deste entregador para calcular taxa dinâmica
        // Nota: courier_id é INTEGER neste banco
        const courierId = user?.id;

        let completedCount = 0;
        if (courierId) {
            try {
                const statsRes = await pool.query(
                    'SELECT COUNT(*) as count FROM marketplace_orders WHERE courier_id = $1 AND status = \'COMPLETED\'',
                    [courierId]
                );
                completedCount = parseInt(statsRes.rows[0]?.count || '0');
            } catch (e) {
                console.error('[LOGISTICS] Erro ao contar entregas:', e);
            }
        }

        // Cálculo de Taxa Dinâmica (Motivação por volume)
        let courierFeeRate = LOGISTICS_SUSTAINABILITY_FEE_RATE;
        if (completedCount >= 50) courierFeeRate = 0.04;
        else if (completedCount >= 10) courierFeeRate = 0.07;

        const result = await pool.query(`
            SELECT 
                mo.id as order_id,
                mo.delivery_fee,
                mo.delivery_address,
                mo.pickup_address,
                mo.contact_phone,
                mo.created_at,
                ml.title as item_title,
                ml.price as item_price,
                ml.image_url,
                seller.name as seller_name,
                seller.id as seller_id,
                buyer.name as buyer_name,
                buyer.id as buyer_id
            FROM marketplace_orders mo
            JOIN marketplace_listings ml ON mo.listing_id = ml.id
            JOIN users seller ON mo.seller_id = seller.id
            JOIN users buyer ON mo.buyer_id = buyer.id
            WHERE mo.delivery_status = 'AVAILABLE'
              AND mo.status = 'WAITING_SHIPPING'
            ORDER BY mo.delivery_fee DESC, mo.created_at ASC
            LIMIT 50
        `);

        return c.json({
            success: true,
            data: result.rows.map(row => {
                const deliveryFee = parseFloat(row.delivery_fee);
                const courierEarnings = deliveryFee * (1 - courierFeeRate);

                return {
                    orderId: row.order_id,
                    itemTitle: row.item_title,
                    itemPrice: parseFloat(row.item_price),
                    imageUrl: row.image_url,
                    deliveryFee: deliveryFee,
                    courierEarnings: courierEarnings.toFixed(2),
                    courierFeeRate: courierFeeRate,
                    deliveryAddress: row.delivery_address,
                    pickupAddress: row.pickup_address,
                    contactPhone: row.contact_phone,
                    sellerName: row.seller_name,
                    sellerId: row.seller_id,
                    buyerName: row.buyer_name,
                    buyerId: row.buyer_id,
                    createdAt: row.created_at,
                };
            })
        });
    } catch (error: any) {
        console.error('[LOGISTICS] Erro ao listar entregas disponíveis:', error);
        return c.json({
            success: false,
            message: 'Erro ao buscar entregas disponíveis no momento.',
            debug: process.env.NODE_ENV !== 'production' ? error.message : undefined
        }, 500);
    }
});

/**
 * POST /logistics/accept/:orderId
 * Entregador aceita uma entrega
 */
logisticsRoutes.post('/accept/:orderId', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const orderId = c.req.param('orderId');
        const pool = getDbPool(c);

        // Verificar se o pedido está disponível
        const orderCheck = await pool.query(
            `SELECT * FROM marketplace_orders 
             WHERE id = $1 AND delivery_status = 'AVAILABLE' AND status = 'WAITING_SHIPPING'`,
            [orderId]
        );

        if (orderCheck.rows.length === 0) {
            return c.json({ success: false, message: 'Entrega não disponível ou já foi aceita.' }, 404);
        }

        const order = orderCheck.rows[0];

        // Impedir que vendedor ou comprador sejam o entregador
        if (order.seller_id === user.id || order.buyer_id === user.id) {
            return c.json({ success: false, message: 'Você não pode entregar seu próprio pedido.' }, 400);
        }

        // Atualizar pedido com o entregador
        await pool.query(
            `UPDATE marketplace_orders 
             SET courier_id = $1, delivery_status = 'ACCEPTED', updated_at = NOW()
             WHERE id = $2`,
            [user.id, orderId]
        );

        // Buscar dados para a notificação
        const listingResult = await pool.query(
            'SELECT title FROM marketplace_listings WHERE id = $1',
            [order.listing_id]
        );

        return c.json({
            success: true,
            message: 'Entrega aceita com sucesso! Vá até o vendedor para coletar o produto.',
            data: {
                orderId,
                itemTitle: listingResult.rows[0]?.title,
                pickupAddress: order.pickup_address,
                deliveryAddress: order.delivery_address,
                contactPhone: order.contact_phone,
                deliveryFee: parseFloat(order.delivery_fee),
            }
        });
    } catch (error) {
        console.error('[LOGISTICS] Erro ao aceitar entrega:', error);
        return c.json({ success: false, message: 'Erro ao aceitar entrega' }, 500);
    }
});

/**
 * POST /logistics/pickup/:orderId
 * Entregador confirma que coletou o produto com o vendedor
 */
logisticsRoutes.post('/pickup/:orderId', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const orderId = c.req.param('orderId');
        const pool = getDbPool(c);

        const body = await c.req.json().catch(() => ({}));
        const { pickupCode } = body;

        // Verificar se o pedido pertence a este entregador
        const orderCheck = await pool.query(
            `SELECT mo.*, ml.title
             FROM marketplace_orders mo
             JOIN marketplace_listings ml ON mo.listing_id = ml.id
             WHERE mo.id = $1 AND mo.courier_id = $2 AND mo.delivery_status = 'ACCEPTED'`,
            [orderId, user.id]
        );

        if (orderCheck.rows.length === 0) {
            return c.json({ success: false, message: 'Pedido não encontrado ou você não é o entregador.' }, 404);
        }

        const order = orderCheck.rows[0];

        // Verificar código de coleta (opcional, mas aumenta segurança)
        if (order.pickup_code && pickupCode && order.pickup_code !== pickupCode) {
            return c.json({ success: false, message: 'Código de coleta incorreto.' }, 400);
        }

        // Atualizar status
        await pool.query(
            `UPDATE marketplace_orders 
             SET delivery_status = 'IN_TRANSIT', picked_up_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [orderId]
        );

        return c.json({
            success: true,
            message: 'Coleta confirmada! Agora leve o produto até o comprador.',
            data: {
                orderId,
                itemTitle: order.title,
                deliveryAddress: order.delivery_address,
                contactPhone: order.contact_phone,
            }
        });
    } catch (error) {
        console.error('[LOGISTICS] Erro ao confirmar coleta:', error);
        return c.json({ success: false, message: 'Erro ao confirmar coleta' }, 500);
    }
});

/**
 * POST /logistics/delivered/:orderId
 * Entregador confirma que entregou ao comprador
 */
logisticsRoutes.post('/delivered/:orderId', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const orderId = c.req.param('orderId');
        const pool = getDbPool(c);

        // Verificar se o pedido pertence a este entregador e está em trânsito
        const orderCheck = await pool.query(
            `SELECT * FROM marketplace_orders 
             WHERE id = $1 AND courier_id = $2 AND delivery_status = 'IN_TRANSIT'`,
            [orderId, user.id]
        );

        if (orderCheck.rows.length === 0) {
            return c.json({ success: false, message: 'Pedido não encontrado ou não está em trânsito.' }, 404);
        }

        // Atualizar status para DELIVERED
        await pool.query(
            `UPDATE marketplace_orders 
             SET delivery_status = 'DELIVERED', delivered_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [orderId]
        );

        // Aumentar Score do Entregador (Bônus de Performance)
        const { updateScore } = await import('../../../application/services/score.service');
        await updateScore(pool, user.id, 15, `Entrega concluída #${orderId}`);

        return c.json({
            success: true,
            message: 'Entrega concluída! +15 Score ganho. Aguardando confirmação do comprador.',
        });
    } catch (error) {
        console.error('[LOGISTICS] Erro ao marcar entrega:', error);
        return c.json({ success: false, message: 'Erro ao marcar entrega como concluída' }, 500);
    }
});

/**
 * POST /logistics/cancel/:orderId
 * Entregador cancela a entrega aceita (antes de coletar)
 */
logisticsRoutes.post('/cancel/:orderId', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const orderId = c.req.param('orderId');
        const pool = getDbPool(c);

        // Só pode cancelar se ainda não coletou
        const orderCheck = await pool.query(
            `SELECT * FROM marketplace_orders 
             WHERE id = $1 AND courier_id = $2 AND delivery_status = 'ACCEPTED'`,
            [orderId, user.id]
        );

        if (orderCheck.rows.length === 0) {
            return c.json({
                success: false,
                message: 'Não é possível cancelar. Pedido não encontrado ou já foi coletado.'
            }, 400);
        }

        // Voltar para AVAILABLE
        await pool.query(
            `UPDATE marketplace_orders 
             SET courier_id = NULL, delivery_status = 'AVAILABLE', updated_at = NOW()
             WHERE id = $1`,
            [orderId]
        );

        return c.json({
            success: true,
            message: 'Entrega cancelada. Outro entregador poderá aceitar.',
        });
    } catch (error) {
        console.error('[LOGISTICS] Erro ao cancelar entrega:', error);
        return c.json({ success: false, message: 'Erro ao cancelar entrega' }, 500);
    }
});

/**
 * GET /logistics/my-deliveries
 * Lista entregas do entregador (ativas e histórico)
 */
logisticsRoutes.get('/my-deliveries', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const status = c.req.query('status'); // 'active', 'completed', ou vazio para todos

        let whereClause = 'WHERE mo.courier_id = $1';
        if (status === 'active') {
            whereClause += ` AND mo.delivery_status IN ('ACCEPTED', 'IN_TRANSIT', 'DELIVERED')`;
        } else if (status === 'completed') {
            whereClause += ` AND mo.status = 'COMPLETED'`;
        }

        const result = await pool.query(`
            SELECT 
                mo.id as order_id,
                mo.delivery_fee,
                mo.delivery_address,
                mo.pickup_address,
                mo.delivery_status,
                mo.status as order_status,
                mo.created_at,
                mo.picked_up_at,
                mo.delivered_at,
                ml.title as item_title,
                ml.image_url,
                seller.name as seller_name,
                buyer.name as buyer_name,
                (mo.delivery_fee * (1 - $2)) as courier_earnings
            FROM marketplace_orders mo
            JOIN marketplace_listings ml ON mo.listing_id = ml.id
            JOIN users seller ON mo.seller_id = seller.id
            JOIN users buyer ON mo.buyer_id = buyer.id
            ${whereClause}
            ORDER BY mo.created_at DESC
            LIMIT 100
        `, [user.id, LOGISTICS_SUSTAINABILITY_FEE_RATE]);

        // Calcular totais
        const totalResult = await pool.query(`
            SELECT 
                COUNT(*) as total_deliveries,
                COALESCE(SUM(delivery_fee * (1 - $2)), 0) as total_earnings
            FROM marketplace_orders
            WHERE courier_id = $1 AND status = 'COMPLETED'
        `, [user.id, LOGISTICS_SUSTAINABILITY_FEE_RATE]);

        const totals = totalResult.rows[0];

        return c.json({
            success: true,
            data: {
                deliveries: result.rows.map(row => ({
                    orderId: row.order_id,
                    itemTitle: row.item_title,
                    imageUrl: row.image_url,
                    deliveryFee: parseFloat(row.delivery_fee),
                    courierEarnings: parseFloat(row.courier_earnings).toFixed(2),
                    deliveryAddress: row.delivery_address,
                    pickupAddress: row.pickup_address,
                    deliveryStatus: row.delivery_status,
                    orderStatus: row.order_status,
                    sellerName: row.seller_name,
                    buyerName: row.buyer_name,
                    createdAt: row.created_at,
                    pickedUpAt: row.picked_up_at,
                    deliveredAt: row.delivered_at,
                })),
                stats: {
                    totalDeliveries: parseInt(totals.total_deliveries),
                    totalEarnings: parseFloat(totals.total_earnings).toFixed(2),
                }
            }
        });
    } catch (error) {
        console.error('[LOGISTICS] Erro ao listar minhas entregas:', error);
        return c.json({ success: false, message: 'Erro ao buscar suas entregas' }, 500);
    }
});

/**
 * GET /logistics/stats
 * Estatísticas do entregador
 */
logisticsRoutes.get('/stats', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        const result = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
                COUNT(*) FILTER (WHERE delivery_status IN ('ACCEPTED', 'IN_TRANSIT', 'DELIVERED')) as in_progress,
                COALESCE(SUM(delivery_fee * (1 - $2)) FILTER (WHERE status = 'COMPLETED'), 0) as total_earned,
                COALESCE(AVG(delivery_fee * (1 - $2)) FILTER (WHERE status = 'COMPLETED'), 0) as avg_earning
            FROM marketplace_orders
            WHERE courier_id = $1
        `, [user.id, LOGISTICS_SUSTAINABILITY_FEE_RATE]);

        const stats = result.rows[0];

        return c.json({
            success: true,
            data: {
                completedDeliveries: parseInt(stats.completed) || 0,
                inProgressDeliveries: parseInt(stats.in_progress) || 0,
                totalEarned: parseFloat(stats.total_earned).toFixed(2),
                avgEarningPerDelivery: parseFloat(stats.avg_earning).toFixed(2),
            }
        });
    } catch (error) {
        console.error('[LOGISTICS] Erro ao buscar estatísticas:', error);
        return c.json({ success: false, message: 'Erro ao buscar estatísticas' }, 500);
    }
});

export { logisticsRoutes };
