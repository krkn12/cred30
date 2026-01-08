import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';
import { executeInTransaction, lockUserBalance, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';
import { getWelcomeBenefit } from '../../../application/services/welcome-benefit.service';
import { MARKETPLACE_ESCROW_FEE_RATE, MARKETPLACE_NON_VERIFIED_FEE_RATE } from '../../../shared/constants/business.constants';

export class MarketplaceController {

    /**
     * Antecipar Recebimento (Vendedor ou Entregador)
     */
    static async anticipate(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');
            const ANTICIPATION_FEE_RATE = 0.05; // 5% de taxa

            const orderRes = await pool.query(
                'SELECT * FROM marketplace_orders WHERE id = $1',
                [orderId]
            );

            if (orderRes.rows.length === 0) return c.json({ success: false, message: 'Pedido não encontrado.' }, 404);

            const order = orderRes.rows[0];
            const metadata = order.metadata || {};

            let amountToAnticipate = 0;
            let anticipationType = ''; // 'SELLER' ou 'COURIER'

            // 1. Identificar quem está pedindo
            if (order.seller_id === user.id) {
                if (metadata.anticipated) return c.json({ success: false, message: 'Venda já antecipada.' }, 400);
                if (!['WAITING_SHIPPING', 'IN_TRANSIT'].includes(order.status)) return c.json({ success: false, message: 'Status inválido.' }, 400);

                amountToAnticipate = parseFloat(order.seller_amount);
                anticipationType = 'SELLER';
            } else if (order.courier_id === user.id) {
                if (metadata.courier_anticipated) return c.json({ success: false, message: 'Frete já antecipado.' }, 400);
                if (order.status !== 'IN_TRANSIT') return c.json({ success: false, message: 'A entrega precisa estar em andamento.' }, 400);

                amountToAnticipate = parseFloat(order.courier_fee || '0');
                anticipationType = 'COURIER';
            } else {
                return c.json({ success: false, message: 'Acesso negado para antecipação.' }, 403);
            }

            if (amountToAnticipate <= 0) return c.json({ success: false, message: 'Valor inválido.' }, 400);

            const anticipationFee = amountToAnticipate * ANTICIPATION_FEE_RATE;
            const netAmount = amountToAnticipate - anticipationFee;

            // 2. Executar
            const result = await executeInTransaction(pool, async (client: any) => {
                if (anticipationType === 'SELLER') {
                    await client.query(
                        `UPDATE marketplace_orders 
                        SET seller_amount = $1, 
                            metadata = jsonb_set(COALESCE(metadata, '{}'), '{anticipated}', 'true') 
                        WHERE id = $2`,
                        [netAmount, orderId]
                    );
                } else {
                    await client.query(
                        `UPDATE marketplace_orders 
                        SET courier_fee = $1, 
                            metadata = jsonb_set(COALESCE(metadata, '{}'), '{courier_anticipated}', 'true') 
                        WHERE id = $2`,
                        [netAmount, orderId]
                    );
                }

                await updateUserBalance(client, user.id, netAmount, 'credit');

                await client.query('UPDATE system_config SET profit_pool = profit_pool + $1', [anticipationFee]);

                await createTransaction(
                    client,
                    user.id,
                    'MARKET_ANTICIPATION',
                    netAmount,
                    `Antecipação (${anticipationType === 'SELLER' ? 'Venda' : 'Frete'}) #${orderId} (Taxa R$ ${anticipationFee.toFixed(2)})`,
                    'APPROVED'
                );

                return { netAmount, fee: anticipationFee };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);

            return c.json({
                success: true,
                message: `Antecipado! R$ ${result.data?.netAmount.toFixed(2)} disponíveis.`,
                data: result.data
            });

        } catch (error) {
            console.error('Anticipation Error:', error);
        }
    }

    /**
     * Listar missões logísticas (Entregas disponíveis)
     */
    static async getLogisticMissions(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT o.id, o.delivery_fee, o.delivery_address, o.pickup_address, 
                       o.pickup_lat, o.pickup_lng, o.delivery_lat, o.delivery_lng,
                       o.created_at, o.contact_phone as buyer_phone,
                       COALESCE(u_seller.phone, u_seller.pix_key) as seller_phone,
                       l.title as item_title, l.image_url,
                       u_seller.name as seller_name, u_buyer.name as buyer_name
                FROM marketplace_orders o
                JOIN marketplace_listings l ON o.listing_id = l.id
                JOIN users u_seller ON o.seller_id = u_seller.id
                JOIN users u_buyer ON o.buyer_id = u_buyer.id
                WHERE o.delivery_status = 'AVAILABLE'
                AND o.seller_id != $1 AND o.buyer_id != $1
                ORDER BY o.delivery_fee DESC
            `, [user.id]);

            return c.json({ success: true, data: result.rows });
        } catch (error) {
            console.error('Error listing missions:', error);
            return c.json({ success: false, message: 'Erro ao buscar missões' }, 500);
        }
    }

    /**
     * Aceitar Missão Logística
     */
    static async acceptMission(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');

            const result = await pool.query(
                `UPDATE marketplace_orders 
                 SET delivery_status = 'ACCEPTED', courier_id = $1, updated_at = NOW()
                 WHERE id = $2 AND delivery_status = 'AVAILABLE'
                 RETURNING pickup_code`,
                [user.id, orderId]
            );

            if (result.rows.length === 0) return c.json({ success: false, message: 'Missão não disponível.' }, 404);

            return c.json({
                success: true,
                message: 'Missão aceita! Dirija-se ao vendedor.',
                pickupCode: result.rows[0].pickup_code
            });
        } catch (error) {
            return c.json({ success: false, message: 'Erro ao aceitar missão' }, 500);
        }
    }

    /**
     * Confirmar Coleta de Item (Sair para entrega)
     */
    static async pickupMission(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');
            const { pickupCode } = await c.req.json();

            const result = await pool.query(
                `UPDATE marketplace_orders 
                 SET delivery_status = 'IN_TRANSIT', updated_at = NOW()
                 WHERE id = $1 AND courier_id = $2 AND pickup_code = $3 AND delivery_status = 'ACCEPTED'`,
                [orderId, user.id, pickupCode]
            );

            if (result.rowCount === 0) return c.json({ success: false, message: 'Código inválido ou missão não encontrada.' }, 400);

            return c.json({ success: true, message: 'Coleta confirmada! Inicie o trajeto.' });
        } catch (error) {
            return c.json({ success: false, message: 'Erro ao confirmar coleta' }, 500);
        }
    }

    /**
     * Atualizar localização GPS do Entregador
     */
    static async updateMissionLocation(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');
            const { lat, lng } = await c.req.json();

            if (typeof lat !== 'number' || typeof lng !== 'number') {
                return c.json({ success: false, message: 'Coordenadas inválidas' }, 400);
            }

            const result = await pool.query(
                `UPDATE marketplace_orders 
                 SET courier_lat = $1, courier_lng = $2, updated_at = NOW()
                 WHERE id = $3 AND courier_id = $4 AND status IN ('WAITING_SHIPPING', 'IN_TRANSIT')
                 RETURNING id`,
                [lat, lng, orderId, user.id]
            );

            if (result.rowCount === 0) {
                return c.json({ success: false, message: 'Pedido não encontrado ou você não é o entregador deste pedido.' }, 403);
            }

            return c.json({ success: true });
        } catch (error) {
            return c.json({ success: false, message: 'Erro ao atualizar localização' }, 500);
        }
    }

    /**
     * Sincronização de Vendas Offline
     */
    static async syncOffline(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();

            // Usando schema local se possível ou validando manualmente
            const { transactions } = body;
            if (!Array.isArray(transactions)) return c.json({ success: false, message: 'Formato inválido' }, 400);

            const results = [];

            for (const tx of transactions) {
                const existing = await pool.query('SELECT id FROM marketplace_orders WHERE offline_token = $1', [tx.id]);
                if (existing.rows.length > 0) {
                    results.push({ id: tx.id, status: 'ALREADY_PROCESSED' });
                    continue;
                }

                if (tx.sellerId !== user.id) {
                    results.push({ id: tx.id, status: 'SKIPPED', message: 'Seller ID mismatch' });
                    continue;
                }

                try {
                    await executeInTransaction(pool, async (client: any) => {
                        const balanceCheck = await lockUserBalance(client, tx.buyerId, tx.amount);
                        if (!balanceCheck.success) throw new Error(`Saldo insuficiente no comprador ${tx.buyerId}`);

                        const sellerResult = await client.query('SELECT asaas_wallet_id FROM users WHERE id = $1', [tx.sellerId]);
                        const isVerified = !!sellerResult.rows[0]?.asaas_wallet_id;
                        const baseFeeRate = isVerified ? MARKETPLACE_ESCROW_FEE_RATE : MARKETPLACE_NON_VERIFIED_FEE_RATE;

                        const welcomeBenefit = await getWelcomeBenefit(client, tx.buyerId);
                        const effectiveEscrowRate = welcomeBenefit.hasDiscount ? baseFeeRate * 0.5 : baseFeeRate;

                        const fee = tx.amount * effectiveEscrowRate;
                        const sellerAmount = tx.amount - fee;

                        await updateUserBalance(client, tx.buyerId, tx.amount, 'debit');
                        await updateUserBalance(client, tx.sellerId, sellerAmount, 'credit');

                        const orderResult = await client.query(
                            `INSERT INTO marketplace_orders (
                                listing_id, buyer_id, seller_id, amount, fee_amount, seller_amount, 
                                status, payment_method, offline_token, delivery_status, delivered_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING id`,
                            [null, tx.buyerId, tx.sellerId, tx.amount, fee, sellerAmount, 'COMPLETED', 'OFFLINE_QR', tx.id, 'DELIVERED']
                        );

                        const orderId = orderResult.rows[0].id;
                        await createTransaction(client, tx.buyerId, 'MARKET_PURCHASE', tx.amount, `Compra Presencial: ${tx.itemTitle}`, 'APPROVED', { orderId });
                        await createTransaction(client, tx.sellerId, 'MARKET_SALE', sellerAmount, `Venda Presencial: ${tx.itemTitle}`, 'APPROVED', { orderId });
                    });
                    results.push({ id: tx.id, status: 'SUCCESS' });
                } catch (err: any) {
                    console.error(`Error processing offline tx ${tx.id}:`, err);
                    results.push({ id: tx.id, status: 'FAILED', message: err.message });
                }
            }

            return c.json({ success: true, results });
        } catch (error) {
            console.error('Offline Sync Error:', error);
            return c.json({ success: false, message: 'Erro na sincronização' }, 500);
        }
    }
}
