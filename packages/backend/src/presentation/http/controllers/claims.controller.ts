import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import {
    DELIVERY_CLAIM_TYPES,
    DELIVERY_INSURANCE_RATE
} from '../../../shared/constants/business.constants';
import { UserContext } from '../../../shared/types/hono.types';


// Schema de validação para criar claim
const createClaimSchema = z.object({
    orderId: z.number(),
    claimType: z.enum(['LOST', 'DAMAGED', 'ACCIDENT', 'THEFT', 'OTHER']),
    description: z.string().min(10, 'Descreva o ocorrido com pelo menos 10 caracteres'),
    evidenceUrls: z.array(z.string()).optional()
});

// Schema para resolver claim (admin)
const resolveClaimSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    sellerRefund: z.number().min(0).optional(),
    buyerRefund: z.number().min(0).optional(),
    courierPenalty: z.number().min(0).optional(),
    adminNotes: z.string().optional()
});

/**
 * Controller para gerenciar incidentes/claims de entregas
 */
export class ClaimsController {

    /**
     * Criar um novo claim (reportar problema)
     * Usado pelo entregador quando ocorre um incidente
     */
    static async createClaim(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();

            const parseResult = createClaimSchema.safeParse(body);
            if (!parseResult.success) {
                return c.json({
                    success: false,
                    message: 'Dados inválidos',
                    errors: parseResult.error.errors
                }, 400);
            }

            const { orderId, claimType, description, evidenceUrls } = parseResult.data;

            // Verificar se o pedido existe e o usuário é o entregador
            const orderCheck = await pool.query(
                `SELECT mo.*, ml.title, ml.price, u_seller.name as seller_name, u_buyer.name as buyer_name
                 FROM marketplace_orders mo
                 LEFT JOIN marketplace_listings ml ON mo.listing_id = ml.id
                 LEFT JOIN users u_seller ON mo.seller_id = u_seller.id
                 LEFT JOIN users u_buyer ON mo.buyer_id = u_buyer.id
                 WHERE mo.id = $1 AND mo.courier_id = $2`,
                [orderId, user.id]
            );

            if (orderCheck.rows.length === 0) {
                return c.json({
                    success: false,
                    message: 'Pedido não encontrado ou você não é o entregador.'
                }, 404);
            }

            const order = orderCheck.rows[0];

            // Verificar se já existe um claim para este pedido
            const existingClaim = await pool.query(
                `SELECT id FROM delivery_claims WHERE order_id = $1`,
                [orderId]
            );

            if (existingClaim.rows.length > 0) {
                return c.json({
                    success: false,
                    message: 'Já existe um incidente reportado para este pedido.'
                }, 400);
            }

            // Criar o claim
            const result = await pool.query(
                `INSERT INTO delivery_claims (order_id, courier_id, reported_by, claim_type, description, evidence_urls)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id`,
                [orderId, user.id, user.id, claimType, description, evidenceUrls || []]
            );

            const claimId = result.rows[0].id;

            // Marcar o pedido como em disputa
            await pool.query(
                `UPDATE marketplace_orders SET status = 'DISPUTE', delivery_status = 'INCIDENT', updated_at = NOW() WHERE id = $1`,
                [orderId]
            );

            // Notificar admin
            await pool.query(
                `INSERT INTO notifications (user_id, title, message, type)
                 SELECT id, 'Incidente Reportado', $1, 'SYSTEM_ALERT'
                 FROM users WHERE is_admin = true`,
                [`Entregador reportou ${claimType} no pedido #${orderId}. Verificar imediatamente.`]
            );

            return c.json({
                success: true,
                message: 'Incidente reportado com sucesso. Nossa equipe irá analisar.',
                data: { claimId }
            });
        } catch (error) {
            console.error('[CLAIMS] Erro ao criar claim:', error);
            return c.json({ success: false, message: 'Erro ao reportar incidente' }, 500);
        }
    }

    /**
     * Listar claims pendentes (admin)
     */
    static async listClaims(c: Context) {
        try {
            const pool = getDbPool(c);
            const status = c.req.query('status') || 'PENDING';

            const result = await pool.query(`
                SELECT 
                    dc.*,
                    mo.amount as order_amount,
                    mo.delivery_fee,
                    ml.title as product_title,
                    ml.price as product_price,
                    u_courier.name as courier_name,
                    u_courier.email as courier_email,
                    u_seller.name as seller_name,
                    u_buyer.name as buyer_name,
                    dif.total_amount as insurance_available
                FROM delivery_claims dc
                LEFT JOIN marketplace_orders mo ON dc.order_id = mo.id
                LEFT JOIN marketplace_listings ml ON mo.listing_id = ml.id
                LEFT JOIN users u_courier ON dc.courier_id = u_courier.id
                LEFT JOIN users u_seller ON mo.seller_id = u_seller.id
                LEFT JOIN users u_buyer ON mo.buyer_id = u_buyer.id
                LEFT JOIN delivery_insurance_fund dif ON dif.order_id = mo.id AND dif.status = 'RESERVED'
                WHERE dc.status = $1
                ORDER BY dc.created_at DESC
            `, [status]);

            return c.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('[CLAIMS] Erro ao listar claims:', error);
            return c.json({ success: false, message: 'Erro ao listar incidentes' }, 500);
        }
    }

    /**
     * Resolver claim (aprovar ou rejeitar) - Admin
     */
    static async resolveClaim(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const claimId = c.req.param('id');
            const body = await c.req.json();

            const parseResult = resolveClaimSchema.safeParse(body);
            if (!parseResult.success) {
                return c.json({
                    success: false,
                    message: 'Dados inválidos',
                    errors: parseResult.error.errors
                }, 400);
            }

            const { status, sellerRefund, buyerRefund, courierPenalty, adminNotes } = parseResult.data;

            // Buscar claim e dados relacionados
            const claimResult = await pool.query(`
                SELECT dc.*, mo.seller_id, mo.buyer_id, mo.courier_id, mo.amount, mo.listing_id,
                       dif.id as insurance_id, dif.total_amount as insurance_amount
                FROM delivery_claims dc
                LEFT JOIN marketplace_orders mo ON dc.order_id = mo.id
                LEFT JOIN delivery_insurance_fund dif ON dif.order_id = mo.id AND dif.status = 'RESERVED'
                WHERE dc.id = $1
            `, [claimId]);

            if (claimResult.rows.length === 0) {
                return c.json({ success: false, message: 'Claim não encontrado' }, 404);
            }

            const claim = claimResult.rows[0];

            if (claim.status !== 'PENDING') {
                return c.json({ success: false, message: 'Este claim já foi resolvido' }, 400);
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Atualizar claim
                await client.query(`
                    UPDATE delivery_claims 
                    SET status = $1, seller_refund = $2, buyer_refund = $3, courier_penalty = $4,
                        admin_notes = $5, resolved_by = $6, resolved_at = NOW()
                    WHERE id = $7
                `, [status, sellerRefund || 0, buyerRefund || 0, courierPenalty || 0, adminNotes, user.id, claimId]);

                if (status === 'APPROVED') {
                    // Usar o fundo de seguro
                    if (claim.insurance_id) {
                        await client.query(`
                            UPDATE delivery_insurance_fund SET status = 'USED', used_for_claim_id = $1 WHERE id = $2
                        `, [claimId, claim.insurance_id]);
                    }

                    // Devolver ao vendedor
                    if (sellerRefund && sellerRefund > 0) {
                        await client.query(
                            `UPDATE users SET balance = balance + $1 WHERE id = $2`,
                            [sellerRefund, claim.seller_id]
                        );
                        await client.query(`
                            INSERT INTO transactions (user_id, type, amount, description, status)
                            VALUES ($1, 'INSURANCE_REFUND', $2, $3, 'APPROVED')
                        `, [claim.seller_id, sellerRefund, `Ressarcimento por incidente na entrega #${claim.order_id}`]);
                    }

                    // Devolver ao comprador
                    if (buyerRefund && buyerRefund > 0) {
                        await client.query(
                            `UPDATE users SET balance = balance + $1 WHERE id = $2`,
                            [buyerRefund, claim.buyer_id]
                        );
                        await client.query(`
                            INSERT INTO transactions (user_id, type, amount, description, status)
                            VALUES ($1, 'INSURANCE_REFUND', $2, $3, 'APPROVED')
                        `, [claim.buyer_id, buyerRefund, `Reembolso por incidente na entrega #${claim.order_id}`]);
                    }

                    // Penalizar entregador
                    if (courierPenalty && courierPenalty > 0) {
                        await client.query(
                            `UPDATE users SET balance = balance - $1 WHERE id = $2`,
                            [courierPenalty, claim.courier_id]
                        );
                        await client.query(`
                            INSERT INTO transactions (user_id, type, amount, description, status)
                            VALUES ($1, 'INSURANCE_PENALTY', $2, $3, 'APPROVED')
                        `, [claim.courier_id, -courierPenalty, `Penalidade por incidente na entrega #${claim.order_id}`]);
                    }

                    // Marcar pedido como cancelado/resolvido
                    await client.query(
                        `UPDATE marketplace_orders SET status = 'CANCELLED', delivery_status = 'RESOLVED', updated_at = NOW() WHERE id = $1`,
                        [claim.order_id]
                    );

                    // Restaurar estoque do produto
                    await client.query(
                        `UPDATE marketplace_listings SET stock = stock + 1, status = 'ACTIVE' WHERE id = $1`,
                        [claim.listing_id]
                    );
                } else {
                    // Rejeitado - liberar seguro de volta ao entregador
                    if (claim.insurance_id) {
                        await client.query(`
                            UPDATE delivery_insurance_fund SET status = 'RELEASED', released_at = NOW() WHERE id = $1
                        `, [claim.insurance_id]);

                        // Devolver contribuição do entregador
                        const insuranceResult = await client.query(
                            `SELECT courier_contribution FROM delivery_insurance_fund WHERE id = $1`,
                            [claim.insurance_id]
                        );
                        if (insuranceResult.rows.length > 0) {
                            const courierContribution = parseFloat(insuranceResult.rows[0].courier_contribution);
                            await client.query(
                                `UPDATE users SET courier_insurance_balance = courier_insurance_balance + $1 WHERE id = $2`,
                                [courierContribution, claim.courier_id]
                            );
                        }
                    }

                    // Pedido volta ao normal (se possível)
                    await client.query(
                        `UPDATE marketplace_orders SET status = 'IN_TRANSIT', delivery_status = 'IN_TRANSIT', updated_at = NOW() WHERE id = $1`,
                        [claim.order_id]
                    );
                }

                // Notificar envolvidos
                const notifyMessage = status === 'APPROVED'
                    ? `Seu incidente #${claimId} foi aprovado. Os valores serão processados.`
                    : `Seu incidente #${claimId} foi rejeitado. ${adminNotes || 'Entre em contato para mais detalhes.'}`;

                await client.query(`
                    INSERT INTO notifications (user_id, title, message, type)
                    VALUES ($1, 'Incidente Resolvido', $2, 'SYSTEM_ALERT')
                `, [claim.courier_id, notifyMessage]);

                await client.query('COMMIT');

                return c.json({
                    success: true,
                    message: `Claim ${status === 'APPROVED' ? 'aprovado' : 'rejeitado'} com sucesso.`
                });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('[CLAIMS] Erro ao resolver claim:', error);
            return c.json({ success: false, message: 'Erro ao resolver incidente' }, 500);
        }
    }

    /**
     * Obter detalhes de um claim específico
     */
    static async getClaimDetails(c: Context) {
        try {
            const pool = getDbPool(c);
            const claimId = c.req.param('id');

            const result = await pool.query(`
                SELECT 
                    dc.*,
                    mo.amount as order_amount,
                    mo.delivery_fee,
                    mo.delivery_address,
                    mo.pickup_address,
                    ml.title as product_title,
                    ml.price as product_price,
                    ml.image_url as product_image,
                    u_courier.name as courier_name,
                    u_courier.email as courier_email,
                    u_courier.phone as courier_phone,
                    u_seller.name as seller_name,
                    u_buyer.name as buyer_name,
                    dif.total_amount as insurance_available,
                    dif.courier_contribution,
                    dif.platform_contribution,
                    u_resolver.name as resolved_by_name
                FROM delivery_claims dc
                LEFT JOIN marketplace_orders mo ON dc.order_id = mo.id
                LEFT JOIN marketplace_listings ml ON mo.listing_id = ml.id
                LEFT JOIN users u_courier ON dc.courier_id = u_courier.id
                LEFT JOIN users u_seller ON mo.seller_id = u_seller.id
                LEFT JOIN users u_buyer ON mo.buyer_id = u_buyer.id
                LEFT JOIN users u_resolver ON dc.resolved_by = u_resolver.id
                LEFT JOIN delivery_insurance_fund dif ON dif.order_id = mo.id
                WHERE dc.id = $1
            `, [claimId]);

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Claim não encontrado' }, 404);
            }

            return c.json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            console.error('[CLAIMS] Erro ao buscar claim:', error);
            return c.json({ success: false, message: 'Erro ao buscar incidente' }, 500);
        }
    }
}
