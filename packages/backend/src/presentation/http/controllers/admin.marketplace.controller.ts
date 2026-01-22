import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';
import { updateScore } from '../../../application/services/score.service';

// Schema de validação
const resolveDisputeSchema = z.object({
    orderId: z.number(),
    resolution: z.enum(['REFUND_BUYER', 'RELEASE_TO_SELLER']),
    penaltyUserId: z.number().optional(),
});

export class AdminMarketplaceController {

    /**
     * Listar pedidos em disputa
     */
    static async listDisputes(c: Context) {
        try {
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT 
                    o.*, 
                    l.title as listing_title, 
                    l.image_url as listing_image, 
                    ub.name as buyer_name, 
                    us.name as seller_name
                FROM marketplace_orders o
                JOIN marketplace_listings l ON o.listing_id = l.id
                JOIN users ub ON o.buyer_id = ub.id
                JOIN users us ON o.seller_id = us.id
                WHERE o.status = 'DISPUTE'
                ORDER BY o.disputed_at ASC
            `);

            return c.json({
                success: true,
                data: result.rows
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Resolver disputa de marketplace
     */
    static async resolveDispute(c: Context) {
        try {
            const body = await c.req.json();
            const { orderId, resolution, penaltyUserId } = resolveDisputeSchema.parse(body);
            const pool = getDbPool(c);

            const orderRes = await pool.query('SELECT * FROM marketplace_orders WHERE id = $1 AND status = \'DISPUTE\'', [orderId]);
            if (orderRes.rows.length === 0) return c.json({ success: false, message: 'Disputa não encontrada.' }, 404);
            const order = orderRes.rows[0];

            await executeInTransaction(pool, async (client) => {
                if (resolution === 'REFUND_BUYER') {
                    await client.query('UPDATE marketplace_orders SET status = \'CANCELLED\', updated_at = NOW() WHERE id = $1', [orderId]);
                    await client.query('UPDATE marketplace_listings SET status = \'ACTIVE\' WHERE id = $1', [order.listing_id]);

                    if (order.payment_method === 'BALANCE') {
                        await updateUserBalance(client, order.buyer_id, parseFloat(order.amount), 'credit');
                        await createTransaction(client, order.buyer_id, 'MARKET_REFUND', parseFloat(order.amount), `Disputa Resolvida: Estorno do Pedido #${orderId}`, 'APPROVED');
                    } else if (order.payment_method === 'CRED30_CREDIT') {
                        await client.query("UPDATE loans SET status = 'CANCELLED' WHERE status = 'APPROVED' AND metadata->>'orderId' = $1", [orderId.toString()]);
                    }
                } else {
                    await client.query('UPDATE marketplace_orders SET status = \'COMPLETED\', updated_at = NOW() WHERE id = $1', [orderId]);

                    const sellerAmount = parseFloat(order.seller_amount);
                    if (order.payment_method === 'CRED30_CREDIT') {
                        await client.query('UPDATE system_config SET system_balance = system_balance - $1', [order.amount]);
                    }
                    await updateUserBalance(client, order.seller_id, sellerAmount, 'credit');

                    const feeAmount = parseFloat(order.fee_amount);
                    await client.query('UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2', [feeAmount * 0.85, feeAmount * 0.15]);

                    await createTransaction(client, order.seller_id, 'MARKET_SALE', sellerAmount, `Disputa Resolvida: Venda #${orderId} Liberada`, 'APPROVED', { orderId });
                }

                if (penaltyUserId) {
                    await updateScore(client, penaltyUserId, -100, `Penalidade: Má fé em disputa de marketplace (#${orderId})`);
                }

                return { success: true };
            });

            return c.json({ success: true, message: `Disputa resolvida: ${resolution}` });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Listar todas as avaliações/reviews
     */
    static async listReviews(c: Context) {
        try {
            const pool = getDbPool(c);

            const result = await pool.query(`
        SELECT 
          r.id,
          r.transaction_id,
          r.rating,
          r.comment,
          r.is_public,
          r.is_approved,
          r.created_at,
          u.name as user_name,
          u.email as user_email,
          t.amount as transaction_amount
        FROM transaction_reviews r
        JOIN users u ON r.user_id = u.id
        JOIN transactions t ON r.transaction_id = t.id
        ORDER BY r.created_at DESC
      `);

            return c.json({
                success: true,
                data: result.rows.map(row => ({
                    ...row,
                    transaction_amount: parseFloat(row.transaction_amount)
                }))
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Aprovar avaliação como depoimento público
     */
    static async approveReview(c: Context) {
        try {
            const reviewId = c.req.param('id');
            const pool = getDbPool(c);

            await pool.query(
                'UPDATE transaction_reviews SET is_approved = TRUE WHERE id = $1',
                [reviewId]
            );

            return c.json({ success: true, message: 'Avaliação aprovada como depoimento!' });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Rejeitar avaliação
     */
    static async rejectReview(c: Context) {
        try {
            const reviewId = c.req.param('id');
            const pool = getDbPool(c);

            await pool.query(
                'UPDATE transaction_reviews SET is_approved = FALSE, is_public = FALSE WHERE id = $1',
                [reviewId]
            );

            return c.json({ success: true, message: 'Avaliação rejeitada.' });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Limpar anúncios antigos sem boost
     */
    static async cleanupOldListings(c: Context) {
        try {
            const body = await c.req.json().catch(() => ({}));
            const daysOld = body.daysOld || 7;
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client) => {
                const countResult = await client.query(`
          SELECT COUNT(*) as total
          FROM marketplace_listings 
          WHERE status = 'ACTIVE' 
            AND (is_boosted = FALSE OR is_boosted IS NULL)
            AND created_at < NOW() - INTERVAL '${daysOld} days'
        `);
                const countToDelete = parseInt(countResult.rows[0].total);

                if (countToDelete === 0) {
                    return { deletedCount: 0 };
                }

                const listingsToDelete = await client.query(`
          SELECT id FROM marketplace_listings 
          WHERE status = 'ACTIVE' 
            AND (is_boosted = FALSE OR is_boosted IS NULL)
            AND created_at < NOW() - INTERVAL '${daysOld} days'
        `);
                const idsToDelete = listingsToDelete.rows.map(r => r.id);

                const ordersCheck = await client.query(`
          SELECT listing_id FROM marketplace_orders 
          WHERE listing_id = ANY($1) 
            AND status NOT IN ('COMPLETED', 'CANCELLED')
        `, [idsToDelete]);

                if (ordersCheck.rows.length > 0) {
                    const idsWithOrders = ordersCheck.rows.map(r => r.listing_id);
                    const safeIdsToDelete = idsToDelete.filter(id => !idsWithOrders.includes(id));

                    if (safeIdsToDelete.length === 0) {
                        return { deletedCount: 0, skipped: idsWithOrders.length };
                    }

                    const deleteResult = await client.query(`
            DELETE FROM marketplace_listings 
            WHERE id = ANY($1)
            RETURNING id
          `, [safeIdsToDelete]);

                    return {
                        deletedCount: deleteResult.rowCount || 0,
                        skipped: idsWithOrders.length
                    };
                }

                const deleteResult = await client.query(`
          DELETE FROM marketplace_listings 
          WHERE id = ANY($1)
          RETURNING id
        `, [idsToDelete]);

                return { deletedCount: deleteResult.rowCount || 0 };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            const { deletedCount, skipped } = result.data!;
            let message = `Limpeza concluída: ${deletedCount} anúncio(s) removido(s).`;
            if (skipped) {
                message += ` ${skipped} anúncio(s) com pedidos pendentes foram mantidos.`;
            }

            return c.json({
                success: true,
                message,
                data: { deletedCount, skipped: skipped || 0, daysOld }
            });
        } catch (error: any) {
            console.error('[CLEANUP] Erro ao limpar anúncios:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Estatísticas de anúncios para limpeza
     */
    static async getCleanupStats(c: Context) {
        try {
            const pool = getDbPool(c);

            const result = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'ACTIVE' AND (is_boosted = FALSE OR is_boosted IS NULL) AND created_at < NOW() - INTERVAL '7 days') as stale_7_days,
          COUNT(*) FILTER (WHERE status = 'ACTIVE' AND (is_boosted = FALSE OR is_boosted IS NULL) AND created_at < NOW() - INTERVAL '14 days') as stale_14_days,
          COUNT(*) FILTER (WHERE status = 'ACTIVE' AND (is_boosted = FALSE OR is_boosted IS NULL) AND created_at < NOW() - INTERVAL '30 days') as stale_30_days,
          COUNT(*) FILTER (WHERE status = 'ACTIVE' AND is_boosted = TRUE) as boosted_active,
          COUNT(*) FILTER (WHERE status = 'ACTIVE') as total_active,
          COUNT(*) as total_all
        FROM marketplace_listings
      `);

            const stats = result.rows[0];

            return c.json({
                success: true,
                data: {
                    stale7Days: parseInt(stats.stale_7_days),
                    stale14Days: parseInt(stats.stale_14_days),
                    stale30Days: parseInt(stats.stale_30_days),
                    boostedActive: parseInt(stats.boosted_active),
                    totalActive: parseInt(stats.total_active),
                    totalAll: parseInt(stats.total_all)
                }
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
