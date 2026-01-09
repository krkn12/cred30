import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, lockUserBalance, updateUserBalance, createTransaction, lockSystemConfig } from '../../../domain/services/transaction.service';
import { updateScore } from '../../../application/services/score.service';
import { UserContext } from '../../../shared/types/hono.types';
import {
    MARKETPLACE_ESCROW_FEE_RATE,
    MARKETPLACE_NON_VERIFIED_FEE_RATE,
    MARKET_CREDIT_INTEREST_RATE,
    MARKET_CREDIT_MAX_INSTALLMENTS,
    MARKET_CREDIT_MIN_SCORE,
    MARKET_CREDIT_MIN_QUOTAS,
    QUOTA_FEE_TAX_SHARE,
    QUOTA_FEE_OPERATIONAL_SHARE,
    QUOTA_FEE_OWNER_SHARE,
    QUOTA_FEE_INVESTMENT_SHARE
} from '../../../shared/constants/business.constants';
import { calculateUserLoanLimit } from '../../../application/services/credit-analysis.service';
import { getWelcomeBenefit, consumeWelcomeBenefitUse } from '../../../application/services/welcome-benefit.service';

// Schemas
const buyListingSchema = z.object({
    listingId: z.number().int(),
    deliveryAddress: z.string().min(10, 'Endereço muito curto').optional(),
    contactPhone: z.string().min(8, 'Telefone inválido').optional(),
    offlineToken: z.string().optional(),
    payerCpfCnpj: z.string().optional(),
    deliveryType: z.enum(['SELF_PICKUP', 'COURIER_REQUEST']).optional().default('SELF_PICKUP'),
    offeredDeliveryFee: z.number().min(0).optional().default(0),
    pickupAddress: z.string().optional(),
    paymentMethod: z.enum(['BALANCE', 'PIX', 'CARD']).default('BALANCE'),
    creditCard: z.object({
        holderName: z.string(),
        number: z.string(),
        expiryMonth: z.string(),
        expiryYear: z.string(),
        ccv: z.string(),
        cpf: z.string(),
    }).optional(),
});

const buyOnCreditSchema = z.object({
    listingId: z.number().int(),
    installments: z.number().int().min(1).max(MARKET_CREDIT_MAX_INSTALLMENTS),
    deliveryAddress: z.string().min(10, 'Endereço muito curto').optional(),
    contactPhone: z.string().min(8, 'Telefone inválido').optional(),
    deliveryType: z.enum(['SELF_PICKUP', 'COURIER_REQUEST']).optional().default('SELF_PICKUP'),
    offeredDeliveryFee: z.number().min(0).optional().default(0),
    pickupAddress: z.string().optional(),
});

export class MarketplaceOrdersController {

    /**
     * Comprar anúncio com saldo
     */
    static async buyListing(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();
            const { listingId, deliveryAddress, contactPhone, offlineToken, paymentMethod, deliveryType, offeredDeliveryFee } = buyListingSchema.parse(body);

            const listingResult = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1 AND status = $2', [listingId, 'ACTIVE']);
            if (listingResult.rows.length === 0) return c.json({ success: false, message: 'Item indisponível.' }, 404);

            const listing = listingResult.rows[0];
            if (listing.seller_id === user.id) return c.json({ success: false, message: 'Você não pode comprar de si mesmo.' }, 400);

            // Detectar se é item digital
            const isDigitalItem = listing.item_type === 'DIGITAL';
            const digitalContent = listing.digital_content;

            // Buscar endereço do vendedor para coleta (só para itens físicos)
            const sellerRes = await pool.query('SELECT address FROM users WHERE id = $1', [listing.seller_id]);
            const finalPickupAddress = body.pickupAddress || sellerRes.rows[0]?.address || 'A combinar com o vendedor';

            const price = parseFloat(listing.price);
            // Items digitais não têm taxa de entrega
            const baseAmountToCharge = isDigitalItem ? price : price + offeredDeliveryFee;

            // Se o pagamento for via saldo
            if (paymentMethod === 'BALANCE') {
                // Determinar taxa base (Verificado vs Não Verificado)
                const sellerCheck = await pool.query('SELECT asaas_wallet_id FROM users WHERE id = $1', [listing.seller_id]);
                const isVerified = !!sellerCheck.rows[0]?.asaas_wallet_id;
                const baseFeeRate = isVerified ? MARKETPLACE_ESCROW_FEE_RATE : MARKETPLACE_NON_VERIFIED_FEE_RATE;

                // ===== SISTEMA DE BENEFÍCIO DE BOAS-VINDAS =====
                const welcomeBenefit = await getWelcomeBenefit(pool, user.id);
                // Se o comprador tem benefício, aplica 50% de desconto sobre a taxa base
                const effectiveEscrowRate = welcomeBenefit.hasDiscount ? baseFeeRate * 0.5 : baseFeeRate;

                console.log(`[MARKETPLACE] ${isDigitalItem ? 'DIGITAL' : 'FÍSICO'} | Vendedor ${isVerified ? 'VERIFICADO' : 'NÃO VERIFICADO'}. Comprador ${user.id} - Benefício: ${welcomeBenefit.hasDiscount ? 'ATIVO' : 'INATIVO'}, Taxa Escrow Final: ${(effectiveEscrowRate * 100).toFixed(1)}%`);

                const fee = price * effectiveEscrowRate;
                const sellerAmount = price - fee;

                const result = await executeInTransaction(pool, async (client) => {
                    const balanceCheck = await lockUserBalance(client, user.id, baseAmountToCharge);
                    if (!balanceCheck.success) throw new Error('Saldo insuficiente (Preço + Entrega).');

                    await updateUserBalance(client, user.id, baseAmountToCharge, 'debit');
                    await client.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['SOLD', listingId]);

                    // Itens digitais são completados instantaneamente
                    const orderStatus = isDigitalItem ? 'COMPLETED' : 'WAITING_SHIPPING';
                    const deliveryStatus = isDigitalItem ? 'DELIVERED' : (deliveryType === 'COURIER_REQUEST' ? 'AVAILABLE' : 'NONE');
                    const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

                    const orderResult = await client.query(
                        `INSERT INTO marketplace_orders (listing_id, buyer_id, seller_id, amount, fee_amount, seller_amount, status, payment_method, delivery_address, pickup_address, contact_phone, offline_token, delivery_status, delivery_fee, pickup_code)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
                        [listingId, user.id, listing.seller_id, price, fee, sellerAmount, orderStatus, 'BALANCE', deliveryAddress, isDigitalItem ? null : finalPickupAddress, contactPhone, offlineToken, deliveryStatus, isDigitalItem ? 0 : offeredDeliveryFee, pickupCode]
                    );
                    const orderId = orderResult.rows[0].id;

                    // Se usou benefício, consumir um uso
                    if (welcomeBenefit.hasDiscount) {
                        await consumeWelcomeBenefitUse(client, user.id, 'MARKETPLACE');
                    }

                    // Para itens digitais, pagar vendedor imediatamente
                    if (isDigitalItem) {
                        await updateUserBalance(client, listing.seller_id, sellerAmount, 'credit');
                        await createTransaction(client, listing.seller_id, 'MARKET_SALE', sellerAmount, `Venda Digital: ${listing.title}`, 'APPROVED', { orderId });
                    }

                    await createTransaction(client, user.id, 'MARKET_PURCHASE', price, `Compra${isDigitalItem ? ' Digital' : ''}: ${listing.title}${welcomeBenefit.hasDiscount ? ' (🎁 Taxa reduzida)' : ''}`, 'APPROVED', { orderId, listingId, welcomeBenefitApplied: welcomeBenefit.hasDiscount, isDigital: isDigitalItem });
                    return { orderId, welcomeBenefitApplied: welcomeBenefit.hasDiscount, usesRemaining: welcomeBenefit.hasDiscount ? welcomeBenefit.usesRemaining - 1 : 0, isDigitalItem, digitalContent: isDigitalItem ? digitalContent : null };
                });

                if (!result.success) return c.json({ success: false, message: result.error }, 400);

                let successMessage = isDigitalItem ? 'Compra de item digital concluída!' : 'Compra realizada!';
                if (result.data?.welcomeBenefitApplied) {
                    successMessage += ` 🎁 Taxa de ${(effectiveEscrowRate * 100).toFixed(1)}% aplicada (Benefício de Boas-Vindas). Usos restantes: ${result.data.usesRemaining}/3`;
                }

                return c.json({
                    success: true,
                    message: successMessage,
                    orderId: result.data?.orderId,
                    welcomeBenefitApplied: result.data?.welcomeBenefitApplied,
                    // Para itens digitais, entregamos o conteúdo na resposta
                    digitalContent: result.data?.digitalContent,
                    isDigitalItem: result.data?.isDigitalItem
                });
            }

            // Pagamento Externo (PIX ou CARTÃO) - Temporariamente desativado
            return c.json({
                success: false,
                message: 'Pagamentos PIX/Cartão externos estão temporariamente indisponíveis. Por favor, deposite saldo na sua conta e use o saldo para comprar.'
            }, 400);

        } catch (error) {
            console.error('Buy Route Error:', error);
            return c.json({ success: false, message: 'Erro ao processar compra' }, 500);
        }
    }

    /**
     * Comprar no Crediário
     */
    static async buyOnCredit(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();
            const { listingId, installments, deliveryAddress, contactPhone } = buyOnCreditSchema.parse(body);

            const userResult = await pool.query(`
                SELECT u.score, COUNT(q.id) as quota_count 
                FROM users u 
                LEFT JOIN quotas q ON u.id = q.user_id AND q.status = 'ACTIVE'
                WHERE u.id = $1
                GROUP BY u.id
            `, [user.id]);

            const userData = userResult.rows[0];
            const userScore = userData?.score || 0;
            const quotaCount = parseInt(userData?.quota_count || '0');

            if (userScore < MARKET_CREDIT_MIN_SCORE) {
                return c.json({ success: false, message: `Score insuficiente (${userScore}). Mínimo: ${MARKET_CREDIT_MIN_SCORE}.` }, 403);
            }

            if (quotaCount < MARKET_CREDIT_MIN_QUOTAS) {
                return c.json({ success: false, message: `Você precisa ter pelo menos ${MARKET_CREDIT_MIN_QUOTAS} cota ativa para comprar parcelado. Isso garante a segurança da comunidade.` }, 403);
            }

            // VERIFICAÇÃO DE PERFIL COMPLETO PARA COMPRAS PARCELADAS
            const verificationCheck = await pool.query(
                'SELECT is_verified, cpf, pix_key, phone FROM users WHERE id = $1',
                [user.id]
            );
            const userVerification = verificationCheck.rows[0];

            if (!userVerification?.is_verified || !userVerification?.cpf || !userVerification?.pix_key) {
                return c.json({
                    success: false,
                    message: 'Para comprar parcelado, você precisa completar a verificação do seu perfil (CPF, PIX e Telefone). Isso protege você e o vendedor.',
                    data: { requiresVerification: true }
                }, 403);
            }

            // Verificação de Limite de Crédito Dinâmico
            const availableLimit = await calculateUserLoanLimit(pool, user.id);
            const listingResult = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1 AND status = $2', [listingId, 'ACTIVE']);

            if (listingResult.rows.length === 0) return c.json({ success: false, message: 'Item indisponível.' }, 404);

            const listing = listingResult.rows[0];
            const price = parseFloat(listing.price);

            if (price > availableLimit) {
                return c.json({
                    success: false,
                    message: `Limite de crédito insuficiente. Seu limite atual é R$ ${availableLimit.toFixed(2)}, mas o produto custa R$ ${price.toFixed(2)}.`,
                    data: { limit: availableLimit }
                }, 403);
            }

            if (listing.seller_id === user.id) return c.json({ success: false, message: 'Você não pode comprar de si mesmo.' }, 400);

            // Buscar endereço do vendedor para coleta
            const sellerRes = await pool.query('SELECT address FROM users WHERE id = $1', [listing.seller_id]);
            const finalPickupAddress = body.pickupAddress || sellerRes.rows[0]?.address || 'A combinar com o vendedor';

            // Determinar taxa base (Verificado vs Não Verificado)
            const sellerCheck = await pool.query('SELECT asaas_wallet_id FROM users WHERE id = $1', [listing.seller_id]);
            const isVerified = !!sellerCheck.rows[0]?.asaas_wallet_id;
            const baseFeeRate = isVerified ? MARKETPLACE_ESCROW_FEE_RATE : MARKETPLACE_NON_VERIFIED_FEE_RATE;

            // ===== SISTEMA DE BENEFÍCIO DE BOAS-VINDAS =====
            const welcomeBenefit = await getWelcomeBenefit(pool, user.id);
            const effectiveEscrowRate = welcomeBenefit.hasDiscount ? baseFeeRate * 0.5 : baseFeeRate;

            const totalInterestRate = MARKET_CREDIT_INTEREST_RATE * installments;

            const result = await executeInTransaction(pool, async (client) => {
                const systemConfig = await lockSystemConfig(client);
                if (parseFloat(systemConfig.system_balance) < price) throw new Error('Limite diário de financiamento atingido.');

                await client.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['SOLD', listingId]);

                const deliveryStatus = buyOnCreditSchema.parse(body).deliveryType === 'COURIER_REQUEST' ? 'AVAILABLE' : 'NONE';
                const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

                const fee = buyOnCreditSchema.parse(body).offeredDeliveryFee;
                const totalWithFee = price + fee;
                const totalAmountWithInterest = totalWithFee * (1 + totalInterestRate);

                const escrowFee = price * effectiveEscrowRate;
                const sellerAmount = price - escrowFee;

                const orderResult = await client.query(
                    `INSERT INTO marketplace_orders (listing_id, buyer_id, seller_id, amount, fee_amount, seller_amount, status, payment_method, delivery_address, pickup_address, contact_phone, delivery_status, delivery_fee, pickup_code)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
                    [listingId, user.id, listing.seller_id, totalWithFee, escrowFee, sellerAmount, 'WAITING_SHIPPING', 'CRED30_CREDIT', deliveryAddress, finalPickupAddress, contactPhone, deliveryStatus, fee, pickupCode]
                );
                const orderId = orderResult.rows[0].id;

                await client.query(
                    `INSERT INTO loans (user_id, amount, installments, interest_rate, total_repayment, status, description, metadata)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [user.id, price, installments, MARKET_CREDIT_INTEREST_RATE, totalAmountWithInterest, 'APPROVED', `Compra: ${listing.title}`, JSON.stringify({ orderId, listingId, type: 'MARKET_FINANCING', welcomeBenefitApplied: welcomeBenefit.hasDiscount })]
                );

                if (welcomeBenefit.hasDiscount) {
                    await consumeWelcomeBenefitUse(client, user.id, 'MARKETPLACE');
                }

                await createTransaction(client, user.id, 'MARKET_PURCHASE_CREDIT', totalAmountWithInterest, `Compra Parcelada: ${listing.title}${welcomeBenefit.hasDiscount ? ' (🎁 Taxa reduzida)' : ''}`, 'APPROVED', { orderId, listingId, welcomeBenefitApplied: welcomeBenefit.hasDiscount });

                return { orderId, welcomeBenefitApplied: welcomeBenefit.hasDiscount, usesRemaining: welcomeBenefit.hasDiscount ? welcomeBenefit.usesRemaining - 1 : 0 };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);

            let successMessage = 'Financiamento Aprovado!';
            if (result.data?.welcomeBenefitApplied) {
                successMessage += ` 🎁 Taxa de ${(effectiveEscrowRate * 100).toFixed(1)}% aplicada (Benefício de Boas-Vindas). Usos restantes: ${result.data.usesRemaining}/3`;
            }

            return c.json({ success: true, message: successMessage, data: { orderId: result.data?.orderId, welcomeBenefitApplied: result.data?.welcomeBenefitApplied } });

        } catch (error) {
            console.error('Buy Credit Error:', error);
            return c.json({ success: false, message: 'Erro ao processar' }, 500);
        }
    }

    /**
     * Listar minhas compras e vendas
     */
    static async getMyOrders(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const limit = parseInt(c.req.query('limit') || '20');
            const offset = parseInt(c.req.query('offset') || '0');

            const result = await pool.query(
                `SELECT o.*, l.title as listing_title, l.image_url as listing_image, 
                  ub.name as buyer_name,
                  us.name as seller_name,
                  uc.name as courier_name,
                  COALESCE(uc.phone, uc.pix_key) as courier_phone,
                  ln.installments, ln.interest_rate, ln.total_repayment
           FROM marketplace_orders o
           JOIN marketplace_listings l ON o.listing_id = l.id
           JOIN users ub ON o.buyer_id = ub.id
           JOIN users us ON o.seller_id = us.id
           LEFT JOIN users uc ON o.courier_id = uc.id
           LEFT JOIN loans ln ON o.payment_method = 'CRED30_CREDIT' 
                AND ln.metadata->>'orderId' = o.id::text 
                AND ln.user_id = o.buyer_id
           WHERE o.buyer_id = $1 OR o.seller_id = $1 OR o.courier_id = $1
           ORDER BY o.created_at DESC
           LIMIT $2 OFFSET $3`,
                [user.id, limit, offset]
            );

            return c.json({
                success: true,
                data: {
                    orders: result.rows,
                    pagination: { limit, offset }
                }
            });
        } catch (error) {
            console.error('Erro ao listar pedidos:', error);
            return c.json({ success: false, message: 'Erro ao buscar seu histórico' }, 500);
        }
    }

    /**
     * Cancelar Pedido
     */
    static async cancelOrder(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');

            const orderRes = await pool.query(
                'SELECT * FROM marketplace_orders WHERE id = $1 AND (buyer_id = $2 OR seller_id = $3)',
                [orderId, user.id, user.id]
            );

            if (orderRes.rows.length === 0) return c.json({ success: false, message: 'Pedido não encontrado.' }, 404);
            const order = orderRes.rows[0];

            if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
                return c.json({ success: false, message: 'Este pedido não pode mais ser cancelado.' }, 400);
            }

            const result = await executeInTransaction(pool, async (client) => {
                await client.query('UPDATE marketplace_orders SET status = $1, updated_at = NOW() WHERE id = $2', ['CANCELLED', orderId]);
                await client.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['ACTIVE', order.listing_id]);

                if (order.payment_method === 'BALANCE') {
                    await updateUserBalance(client, order.buyer_id, parseFloat(order.amount), 'credit');
                    await createTransaction(client, order.buyer_id, 'MARKET_REFUND', parseFloat(order.amount), `Estorno: Pedido #${orderId} cancelado`, 'APPROVED');
                } else if (order.payment_method === 'CRED30_CREDIT') {
                    await client.query(
                        "UPDATE loans SET status = 'CANCELLED' WHERE status = 'APPROVED' AND metadata->>'orderId' = $1 AND user_id = $2",
                        [orderId.toString(), order.buyer_id]
                    );
                    await createTransaction(client, order.buyer_id, 'MARKET_REFUND_CREDIT', 0, `Estorno Crédito: Pedido #${orderId} cancelado`, 'APPROVED');
                }

                return { success: true };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);
            return c.json({ success: true, message: 'Pedido cancelado e valores estornados com sucesso!' });
        } catch (error) {
            console.error('Cancel Order Error:', error);
            return c.json({ success: false, message: 'Erro ao cancelar pedido' }, 500);
        }
    }

    /**
     * Abrir Disputa
     */
    static async openDispute(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');
            const { reason } = await c.req.json();

            if (!reason) return c.json({ success: false, message: 'O motivo da disputa é obrigatório.' }, 400);

            const result = await pool.query(
                `UPDATE marketplace_orders 
         SET status = 'DISPUTE', dispute_reason = $1, disputed_at = NOW(), updated_at = NOW()
         WHERE id = $2 AND (buyer_id = $3 OR seller_id = $3) AND status IN ('WAITING_SHIPPING', 'IN_TRANSIT', 'DELIVERED')
         RETURNING *`,
                [reason, orderId, user.id]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Pedido não encontrado ou status não permite disputa.' }, 404);
            }

            return c.json({
                success: true,
                message: 'Disputa aberta com sucesso. O saldo foi congelado e nossa equipe de suporte irá analisar o caso.'
            });
        } catch (error) {
            console.error('Dispute Error:', error);
            return c.json({ success: false, message: 'Erro ao abrir disputa' }, 500);
        }
    }

    /**
     * Avaliar Parceiro (Score)
     */
    static async rateOrder(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');
            const { rating, comment } = await c.req.json();

            if (typeof rating !== 'number' || rating < -5 || rating > 5) {
                return c.json({ success: false, message: 'Nota inválida. Use de -5 a 5.' }, 400);
            }

            const orderResult = await pool.query(
                'SELECT * FROM marketplace_orders WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2) AND status = $3',
                [orderId, user.id, 'COMPLETED']
            );

            if (orderResult.rows.length === 0) {
                return c.json({ success: false, message: 'Pedido não encontrado ou não finalizado.' }, 404);
            }

            const order = orderResult.rows[0];
            const isBuyer = order.buyer_id === user.id;
            const targetUserId = isBuyer ? order.seller_id : order.buyer_id;

            const existingRating = await pool.query(
                'SELECT 1 FROM marketplace_ratings WHERE order_id = $1 AND rater_id = $2',
                [orderId, user.id]
            );
            if (existingRating.rows.length > 0) {
                return c.json({ success: false, message: 'Você já avaliou este pedido.' }, 400);
            }

            await executeInTransaction(pool, async (client) => {
                await client.query(
                    `INSERT INTO marketplace_ratings (order_id, rater_id, rated_user_id, rating, comment, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
                    [orderId, user.id, targetUserId, rating, comment || null]
                );

                const scoreImpact = rating * 10;
                const reason = isBuyer ? `Avaliação como Vendedor (Pedido #${orderId})` : `Avaliação como Comprador (Pedido #${orderId})`;
                await updateScore(client, targetUserId, scoreImpact, reason);

                return { success: true };
            });

            return c.json({ success: true, message: 'Avaliação registrada com sucesso!' });
        } catch (error) {
            console.error('Rate Order Error:', error);
            return c.json({ success: false, message: 'Erro ao avaliar pedido' }, 500);
        }
    }

    /**
     * Confirmar Recebimento (Finaliza o pedido e libera pagamentos)
     */
    static async confirmReceipt(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json().catch(() => ({}));
            const { verificationCode } = body;
            const orderId = c.req.param('id');

            // Buscar pedido esperando entrega
            const orderResult = await pool.query(
                `SELECT o.*, l.title, l.quota_id FROM marketplace_orders o 
           JOIN marketplace_listings l ON o.listing_id = l.id 
           WHERE o.id = $1 AND o.status IN ('WAITING_SHIPPING', 'IN_TRANSIT')
           AND (o.buyer_id = $2 OR (o.offline_token IS NOT NULL AND $3::text IS NOT NULL AND o.offline_token = $3))`,
                [orderId, user.id, verificationCode]
            );

            if (orderResult.rows.length === 0) {
                return c.json({ success: false, message: 'Pedido não encontrado ou já finalizado.' }, 404);
            }

            const order = orderResult.rows[0];

            const result = await executeInTransaction(pool, async (client: any) => {
                // 1. Finalizar pedido
                await client.query(
                    'UPDATE marketplace_orders SET status = $1, delivery_status = $2, updated_at = NOW() WHERE id = $3',
                    ['COMPLETED', 'DELIVERED', orderId]
                );

                // 1.1 Se for uma cota, transferir propriedade
                if (order.quota_id) {
                    const transferResult = await client.query(
                        'UPDATE quotas SET user_id = $1 WHERE id = $2 RETURNING id',
                        [order.buyer_id, order.quota_id]
                    );

                    if (transferResult.rowCount === 0) {
                        throw new Error('Falha ao transferir a cota-parte.');
                    }

                    // Atualizar Score por aquisição
                    await updateScore(client, order.buyer_id, 50, `Aquisição de cota-parte via mercado secundário #${order.quota_id}`);
                    await updateScore(client, order.seller_id, 20, `Cessão bem-sucedida de cota-parte #${order.quota_id}`);
                }

                // 2. Liberar saldo para o vendedor (SE AINDA NÃO FOI ANTECIPADO)
                const isAnticipated = order.metadata?.anticipated;
                const sellerAmount = parseFloat(order.seller_amount);
                const totalFee = parseFloat(order.fee_amount || '0');

                if (totalFee > 0) {
                    // DIVISÃO DA TAXA DE VENDA DO MARKETPLACE
                    // 50% para Cotistas (Profit Pool)
                    const profitShare = totalFee * 0.5;

                    // 50% para a Empresa (Sistema) dividida em 4 reservas
                    const systemShare = totalFee * 0.5;
                    const taxPart = systemShare * QUOTA_FEE_TAX_SHARE; // 25% do systemShare
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
                        `, [profitShare, taxPart, operPart, ownerPart, investPart]
                    );
                }

                if (!isAnticipated) {
                    // Fluxo Normal: Vendedor recebe agora
                    await updateUserBalance(client, order.seller_id, sellerAmount, 'credit');
                    await createTransaction(client, order.seller_id, 'MARKET_SALE', sellerAmount, `Venda Concluída: ${order.title}`, 'APPROVED', { orderId });
                }

                // 3. Pagar entregador se houver
                const courierFee = parseFloat(order.delivery_fee || '0');
                const isCourierAnticipated = order.metadata?.courier_anticipated;

                if (order.courier_id && courierFee > 0) {
                    const courierPart = courierFee * 0.85; // 85% para o entregador
                    const systemPart = courierFee * 0.15;  // 15% para o sistema

                    if (!isCourierAnticipated) {
                        await updateUserBalance(client, order.courier_id, courierPart, 'credit');
                        await createTransaction(client, order.courier_id, 'LOGISTIC_EARN', courierPart, `Entrega realizada: ${order.title}`, 'APPROVED', { orderId });
                    }

                    // DIVISÃO DA TAXA DE LOGÍSTICA (15%)
                    // Metade para Cotistas (Profit Pool) e Metade para a Empresa (System Balance)
                    const profitShare = systemPart / 2;
                    const companyShare = systemPart / 2;

                    await client.query('UPDATE system_config SET profit_pool = profit_pool + $1, system_balance = system_balance + $2', [profitShare, companyShare]);
                }

                // 4. Se foi no crediário, o dinheiro sai do caixa do sistema para o vendedor + courier
                if (order.payment_method === 'CRED30_CREDIT') {
                    await client.query('UPDATE system_config SET system_balance = system_balance - $1', [order.amount]);
                }

                return { success: true };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);
            return c.json({ success: true, message: 'Entrega confirmada! Saldo liberado ao vendedor.' });
        } catch (error) {
            console.error('Receive Order Error:', error);
            return c.json({ success: false, message: 'Erro ao processar liberação de fundos' }, 500);
        }
    }

    /**
     * Rastreio do Pedido (GPS)
     */
    static async getOrderTracking(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');

            const result = await pool.query(
                `SELECT o.id, o.status, o.delivery_status, o.courier_id, 
                o.courier_lat, o.courier_lng, 
                o.pickup_lat, o.pickup_lng, o.delivery_lat, o.delivery_lng,
                o.delivery_address, o.pickup_address,
                u.name as courier_name, u.phone as courier_phone
         FROM marketplace_orders o
         LEFT JOIN users u ON o.courier_id = u.id
         WHERE o.id = $1 AND (o.buyer_id = $2 OR o.courier_id = $2 OR o.seller_id = $2)`,
                [orderId, user.id]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Rastreio não disponível.' }, 404);
            }

            return c.json({ success: true, data: result.rows[0] });
        } catch (error) {
            return c.json({ success: false, message: 'Erro ao buscar rastreio' }, 500);
        }
    }
}
