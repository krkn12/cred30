import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { LOGISTICS_SUSTAINABILITY_FEE_RATE } from '../../../shared/constants/business.constants';
import { UserContext } from '../../../shared/types/hono.types';

export class LogisticsController {
    /**
     * Lista entregas disponíveis
     */
    static async listAvailable(c: Context) {
        try {
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT 
                    mo.id as order_id,
                    mo.delivery_fee,
                    mo.delivery_address,
                    mo.pickup_address,
                    mo.contact_phone,
                    mo.created_at,
                    mo.pickup_lat,
                    mo.pickup_lng,
                    mo.delivery_lat,
                    mo.delivery_lng,
                    ml.title as item_title,
                    ml.price as item_price,
                    ml.image_url,
                    seller.name as seller_name,
                    seller.id as seller_id,
                    buyer.name as buyer_name,
                    buyer.id as buyer_id
                FROM marketplace_orders mo
                LEFT JOIN marketplace_listings ml ON mo.listing_id = ml.id
                LEFT JOIN users seller ON mo.seller_id = seller.id
                LEFT JOIN users buyer ON mo.buyer_id = buyer.id
                WHERE mo.delivery_status = 'AVAILABLE'
                  AND mo.status = 'WAITING_SHIPPING'
                ORDER BY mo.delivery_fee DESC, mo.created_at ASC
                LIMIT 50
            `);

            return c.json({
                success: true,
                data: result.rows.map(row => {
                    const deliveryFee = parseFloat(row.delivery_fee || '0');
                    const courierEarnings = deliveryFee * (1 - LOGISTICS_SUSTAINABILITY_FEE_RATE);

                    return {
                        orderId: row.order_id,
                        itemTitle: row.item_title,
                        itemPrice: parseFloat(row.item_price || '0'),
                        imageUrl: row.image_url,
                        deliveryFee: deliveryFee,
                        courierEarnings: courierEarnings.toFixed(2),
                        deliveryAddress: row.delivery_address,
                        pickupAddress: row.pickup_address,
                        pickupLat: row.pickup_lat ? parseFloat(row.pickup_lat) : null,
                        pickupLng: row.pickup_lng ? parseFloat(row.pickup_lng) : null,
                        deliveryLat: row.delivery_lat ? parseFloat(row.delivery_lat) : null,
                        deliveryLng: row.delivery_lng ? parseFloat(row.delivery_lng) : null,
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
            console.error('[LOGISTICS] Erro ao listar entregas:', error);
            return c.json({ success: false, message: `Erro ao buscar entregas: ${error.message}` }, 500);
        }
    }

    /**
     * Aceitar entrega
     */
    static async acceptDelivery(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const orderId = c.req.param('orderId');
            const pool = getDbPool(c);

            // 1. Verificar Penalidade
            const userCheck = await pool.query('SELECT courier_penalty_until FROM users WHERE id = $1', [user.id]);
            if (userCheck.rows[0]?.courier_penalty_until && new Date(userCheck.rows[0].courier_penalty_until) > new Date()) {
                const waitTime = Math.ceil((new Date(userCheck.rows[0].courier_penalty_until).getTime() - new Date().getTime()) / 60000);
                return c.json({ success: false, message: `Você está em período de penalidade por cancelamento. Aguarde ${waitTime} minutos.` }, 403);
            }

            // 2. Verificar Entrega Ativa (Regra: Uma por vez)
            const activeOrderCheck = await pool.query(
                `SELECT id FROM marketplace_orders 
                 WHERE courier_id = $1 AND delivery_status IN ('ACCEPTED', 'IN_TRANSIT', 'DELIVERED')`,
                [user.id]
            );

            if (activeOrderCheck.rows.length > 0) {
                return c.json({ success: false, message: 'Você já tem uma entrega em andamento. Finalize-a antes de pegar outra.' }, 400);
            }

            const orderCheck = await pool.query(
                `SELECT * FROM marketplace_orders 
                 WHERE id = $1 AND delivery_status = 'AVAILABLE' AND status = 'WAITING_SHIPPING'`,
                [orderId]
            );

            if (orderCheck.rows.length === 0) {
                return c.json({ success: false, message: 'Entrega não disponível ou já foi aceita.' }, 404);
            }

            const order = orderCheck.rows[0];

            if (order.seller_id === user.id || order.buyer_id === user.id) {
                return c.json({ success: false, message: 'Você não pode entregar seu próprio pedido.' }, 400);
            }

            await pool.query(
                `UPDATE marketplace_orders 
                 SET courier_id = $1, delivery_status = 'ACCEPTED', updated_at = NOW()
                 WHERE id = $2`,
                [user.id, orderId]
            );

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
    }

    /**
     * Confirmar coleta
     */
    static async pickupDelivery(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const orderId = c.req.param('orderId');
            const pool = getDbPool(c);

            const body = await c.req.json().catch(() => ({}));
            const { pickupCode } = body;

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

            if (order.pickup_code && pickupCode && order.pickup_code !== pickupCode) {
                return c.json({ success: false, message: 'Código de coleta incorreto.' }, 400);
            }

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
    }

    /**
     * Marcar como entregue
     */
    static async markDelivered(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const orderId = c.req.param('orderId');
            const pool = getDbPool(c);

            const orderCheck = await pool.query(
                `SELECT * FROM marketplace_orders 
                 WHERE id = $1 AND courier_id = $2 AND delivery_status = 'IN_TRANSIT'`,
                [orderId, user.id]
            );

            if (orderCheck.rows.length === 0) {
                return c.json({ success: false, message: 'Pedido não encontrado ou não está em trânsito.' }, 404);
            }

            await pool.query(
                `UPDATE marketplace_orders 
                 SET delivery_status = 'DELIVERED', delivered_at = NOW(), updated_at = NOW()
                 WHERE id = $1`,
                [orderId]
            );

            return c.json({
                success: true,
                message: 'Entrega marcada como concluída! Aguardando confirmação do comprador.',
            });
        } catch (error) {
            console.error('[LOGISTICS] Erro ao marcar entrega:', error);
            return c.json({ success: false, message: 'Erro ao marcar entrega como concluída' }, 500);
        }
    }

    /**
     * Cancelar entrega (antes de coletar)
     */
    static async cancelDelivery(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const orderId = c.req.param('orderId');
            const pool = getDbPool(c);

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

            await pool.query(
                `UPDATE marketplace_orders 
                 SET courier_id = NULL, delivery_status = 'AVAILABLE', updated_at = NOW()
                 WHERE id = $1`,
                [orderId]
            );

            // Aplicar Penalidade de 30 minutos
            await pool.query(
                `UPDATE users 
                 SET courier_penalty_until = NOW() + INTERVAL '30 minutes' 
                 WHERE id = $1`,
                [user.id]
            );

            return c.json({
                success: true,
                message: 'Entrega cancelada. Outro entregador poderá aceitar.',
            });
        } catch (error) {
            console.error('[LOGISTICS] Erro ao cancelar entrega:', error);
            return c.json({ success: false, message: 'Erro ao cancelar entrega' }, 500);
        }
    }

    /**
     * Listar minhas entregas
     */
    static async listMyDeliveries(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const status = c.req.query('status');

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
                    seller.phone as seller_phone,
                    buyer.name as buyer_name,
                    buyer.phone as buyer_phone
                FROM marketplace_orders mo
                LEFT JOIN marketplace_listings ml ON mo.listing_id = ml.id
                LEFT JOIN users seller ON mo.seller_id = seller.id
                LEFT JOIN users buyer ON mo.buyer_id = buyer.id
                ${whereClause}
                ORDER BY mo.created_at DESC
                LIMIT 100
            `, [parseInt(user.id.toString())]);

            const totalResult = await pool.query(`
                SELECT 
                    COUNT(*) as total_deliveries,
                    COALESCE(SUM(CAST(delivery_fee AS NUMERIC) * (1.0 - CAST($2 AS NUMERIC))), 0) as total_earnings
                FROM marketplace_orders
                WHERE courier_id = $1 AND status = 'COMPLETED'
            `, [parseInt(user.id.toString()), LOGISTICS_SUSTAINABILITY_FEE_RATE]);

            const totals = totalResult.rows[0];

            return c.json({
                success: true,
                data: {
                    deliveries: result.rows.map(row => {
                        const deliveryFee = parseFloat(row.delivery_fee || '0');
                        const courierEarnings = deliveryFee * (1 - LOGISTICS_SUSTAINABILITY_FEE_RATE);

                        return {
                            orderId: row.order_id,
                            itemTitle: row.item_title,
                            imageUrl: row.image_url,
                            deliveryFee: deliveryFee,
                            courierEarnings: courierEarnings.toFixed(2),
                            deliveryAddress: row.delivery_address,
                            pickupAddress: row.pickup_address,
                            deliveryStatus: row.delivery_status,
                            orderStatus: row.order_status,
                            sellerName: row.seller_name,
                            sellerPhone: row.seller_phone,
                            buyerName: row.buyer_name,
                            buyerPhone: row.buyer_phone,
                            createdAt: row.created_at,
                            pickedUpAt: row.picked_up_at,
                            deliveredAt: row.delivered_at,
                        };
                    }),
                    stats: {
                        totalDeliveries: parseInt(totals.total_deliveries),
                        totalEarnings: parseFloat(totals.total_earnings).toFixed(2),
                    }
                }
            });
        } catch (error: any) {
            console.error('[LOGISTICS] Erro ao listar minhas entregas:', error);
            return c.json({ success: false, message: `Erro ao buscar suas entregas: ${error.message}` }, 500);
        }
    }

    /**
     * Estatísticas do entregador
     */
    static async getStats(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
                    COUNT(*) FILTER (WHERE delivery_status IN ('ACCEPTED', 'IN_TRANSIT', 'DELIVERED')) as in_progress,
                    COALESCE(SUM(CAST(delivery_fee AS NUMERIC) * (1.0 - CAST($2 AS NUMERIC))) FILTER (WHERE status = 'COMPLETED'), 0) as total_earned,
                    COALESCE(AVG(CAST(delivery_fee AS NUMERIC) * (1.0 - CAST($2 AS NUMERIC))) FILTER (WHERE status = 'COMPLETED'), 0) as avg_earning
                FROM marketplace_orders
                WHERE courier_id = $1
            `, [parseInt(user.id.toString()), LOGISTICS_SUSTAINABILITY_FEE_RATE]);

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
        } catch (error: any) {
            console.error('[LOGISTICS] Erro ao buscar estatísticas:', error);
            return c.json({ success: false, message: `Erro ao buscar estatísticas: ${error.message}` }, 500);
        }
    }

    /**
     * Verificar status do cadastro de entregador
     */
    static async getCourierStatus(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(
                `SELECT is_courier, courier_status, courier_vehicle, courier_city, courier_state, courier_created_at, courier_price_per_km 
                 FROM users WHERE id = $1`,
                [user.id]
            );

            const userData = result.rows[0];

            return c.json({
                success: true,
                isCourier: userData?.is_courier || false,
                status: userData?.courier_status || null,
                vehicle: userData?.courier_vehicle || null,
                city: userData?.courier_city || null,
                state: userData?.courier_state || null,
                registeredAt: userData?.courier_created_at || null,
                pricePerKm: parseFloat(userData?.courier_price_per_km || '2.00'),
            });
        } catch (error: any) {
            console.error('[LOGISTICS] Erro ao buscar status do entregador:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Registrar como entregador
     */
    static async registerCourier(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();

            const { cpf, phone, city, state, vehicle } = body;

            if (!cpf || !phone || !city || !state || !vehicle) {
                return c.json({
                    success: false,
                    message: 'Preencha todos os campos obrigatórios: CPF, Telefone, Cidade, Estado e Veículo'
                }, 400);
            }

            const validVehicles = ['BIKE', 'MOTO', 'CAR', 'TRUCK'];
            if (!validVehicles.includes(vehicle)) {
                return c.json({
                    success: false,
                    message: 'Tipo de veículo inválido. Escolha: BIKE, MOTO, CAR ou TRUCK'
                }, 400);
            }

            const existingCheck = await pool.query(`SELECT is_courier FROM users WHERE id = $1`, [user.id]);
            if (existingCheck.rows[0]?.is_courier) {
                return c.json({ success: false, message: 'Você já é um entregador registrado' }, 400);
            }

            await pool.query(
                `UPDATE users SET 
                    is_courier = TRUE,
                    courier_status = 'pending',
                    courier_vehicle = $1,
                    courier_phone = $2,
                    courier_cpf = $3,
                    courier_city = $4,
                    courier_state = $5,
                    courier_price_per_km = $6,
                    courier_created_at = CURRENT_TIMESTAMP
                 WHERE id = $7`,
                [vehicle, phone, cpf, city, state, body.pricePerKm || 2.00, user.id]
            );

            return c.json({
                success: true,
                message: 'Cadastro enviado para aprovação!',
                courier: { status: 'pending', vehicle: vehicle }
            });
        } catch (error: any) {
            console.error('[LOGISTICS] Erro ao registrar:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Atualizar preço por KM
     */
    static async updateCourierPrice(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const { pricePerKm } = await c.req.json();

            if (!pricePerKm || isNaN(parseFloat(pricePerKm))) {
                return c.json({ success: false, message: 'Preço por KM inválido' }, 400);
            }

            const result = await pool.query(
                `UPDATE users SET courier_price_per_km = $1 WHERE id = $2 AND is_courier = TRUE RETURNING name`,
                [parseFloat(pricePerKm), user.id]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Usuário não é entregador' }, 404);
            }

            return c.json({ success: true, message: 'Preço por KM atualizado!' });
        } catch (error: any) {
            console.error('[LOGISTICS] Erro ao atualizar preço:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
