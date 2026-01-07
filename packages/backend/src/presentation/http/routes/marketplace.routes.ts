import { Hono, Context } from 'hono';
import { z } from 'zod';
import { authMiddleware, securityLockMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import {
    MARKETPLACE_ESCROW_FEE_RATE,
    MARKETPLACE_NON_VERIFIED_FEE_RATE,
    MARKET_CREDIT_INTEREST_RATE,
    MARKET_CREDIT_MAX_INSTALLMENTS,
    MARKET_CREDIT_MIN_SCORE,
    MARKET_CREDIT_MIN_QUOTAS,
    LOGISTICS_SUSTAINABILITY_FEE_RATE,
    QUOTA_FEE_TAX_SHARE,
    QUOTA_FEE_OPERATIONAL_SHARE,
    QUOTA_FEE_OWNER_SHARE,
    QUOTA_FEE_INVESTMENT_SHARE
} from '../../../shared/constants/business.constants';
import { UserContext } from '../../../shared/types/hono.types';
import { executeInTransaction, lockUserBalance, updateUserBalance, createTransaction, lockSystemConfig } from '../../../domain/services/transaction.service';
import { calculateUserLoanLimit } from '../../../application/services/credit-analysis.service';
import { updateScore } from '../../../application/services/score.service';

import { getWelcomeBenefit, consumeWelcomeBenefitUse } from '../../../application/services/welcome-benefit.service';

const marketplaceRoutes = new Hono();

// Aplicar trava de segurança para ações sensíveis de mercado
marketplaceRoutes.use('/create', securityLockMiddleware);
marketplaceRoutes.use('/buy', securityLockMiddleware);
marketplaceRoutes.use('/buy-on-credit', securityLockMiddleware);
marketplaceRoutes.use('/boost', securityLockMiddleware);

// Esquemas de validação
const createListingSchema = z.object({
    title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres').max(255),
    description: z.string().min(5, 'Descrição deve ter pelo menos 5 caracteres'),
    price: z.number().positive('Preço deve ser maior que zero'),
    category: z.string().optional(),
    imageUrl: z.string().optional(),
    quotaId: z.number().int().optional(),
});

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

const offlineTransactionSchema = z.object({
    id: z.string(),
    buyerId: z.string(),
    sellerId: z.string(),
    amount: z.number(),
    itemTitle: z.string(),
    timestamp: z.number(),
    signature: z.string().optional()
});

const syncOfflineSchema = z.object({
    transactions: z.array(offlineTransactionSchema)
});

/**
 * Listar todos os anúncios ativos no Mercado Cred30
 */
marketplaceRoutes.get('/listings', authMiddleware, async (c: Context) => {
    try {
        const pool = getDbPool(c);
        const limit = parseInt(c.req.query('limit') || '20');
        const offset = parseInt(c.req.query('offset') || '0');
        const category = c.req.query('category');
        const search = c.req.query('search');

        // Otimização: Busca unificada via SQL com paginação e filtros
        const combinedResult = await pool.query(`
            SELECT * FROM (
                (SELECT l.id::text, l.title, l.description, l.price::float, l.image_url, l.category, 
                        u.name as seller_name, l.seller_id::text, l.is_boosted, l.created_at, l.status, 'P2P' as type,
                        NULL as affiliate_url, l.quota_id, u.asaas_wallet_id, u.address as seller_address
                 FROM marketplace_listings l 
                 JOIN users u ON l.seller_id = u.id 
                 WHERE l.status = 'ACTIVE'
                 AND ($3::text IS NULL OR $3 = 'TODOS' OR l.category = $3)
                 AND ($4::text IS NULL OR (l.title ILIKE '%' || $4 || '%' OR l.description ILIKE '%' || $4 || '%')))
                UNION ALL
                (SELECT p.id::text, p.title, p.description, p.price::float, p.image_url, p.category, 
                        'Cred30 Parceiros' as seller_name, '0' as seller_id, true as is_boosted, p.created_at, 'ACTIVE' as status, 'AFFILIATE' as type,
                        p.affiliate_url, NULL as quota_id, NULL as asaas_wallet_id, 'Brasil' as seller_address
                 FROM products p
                 WHERE p.active = true
                 AND ($3::text IS NULL OR $3 = 'TODOS' OR p.category = $3)
                 AND ($4::text IS NULL OR (p.title ILIKE '%' || $4 || '%' OR p.description ILIKE '%' || $4 || '%')))
            ) as combined
            ORDER BY is_boosted DESC, created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset, category || null, search || null]);

        return c.json({
            success: true,
            data: {
                listings: combinedResult.rows,
                pagination: { limit, offset }
            }
        });
    } catch (error) {
        console.error('Erro ao listar anúncios:', error);
        return c.json({ success: false, message: 'Erro ao buscar anúncios' }, 500);
    }
});

marketplaceRoutes.post('/create', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const parseResult = createListingSchema.safeParse(body);

        if (!parseResult.success) {
            return c.json({
                success: false,
                message: 'Dados inválidos',
                errors: parseResult.error.errors
            }, 400);
        }

        const { title, description, price, category, imageUrl, quotaId } = parseResult.data;

        // Se for uma cota, verificar se pertence ao usuário e está ativa
        if (quotaId) {
            const quotaCheck = await pool.query('SELECT * FROM quotas WHERE id = $1 AND user_id = $2 AND status = $3', [quotaId, user.id, 'ACTIVE']);
            if (quotaCheck.rows.length === 0) {
                return c.json({ success: false, message: 'Você não possui esta cota ou ela não está ativa para repasse.' }, 403);
            }
        }

        const result = await pool.query(
            `INSERT INTO marketplace_listings (seller_id, title, description, price, category, image_url, quota_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [user.id, title, description, price, category || (quotaId ? 'COTAS' : 'OUTROS'), imageUrl, quotaId]
        );

        return c.json({
            success: true,
            listing: result.rows[0],
            message: 'Anúncio publicado com sucesso!'
        });
    } catch (error) {
        console.error('Erro ao criar anúncio:', error);
        return c.json({ success: false, message: 'Erro ao publicar anúncio' }, 500);
    }
});

/**
 * Contato P2P Direto - SEM intermediação
 * Retorna dados do vendedor para negociação direta via WhatsApp
 * Sem taxas, mas também sem proteção da plataforma
 */
marketplaceRoutes.get('/contact/:listingId', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const listingId = c.req.param('listingId');

        // Buscar anúncio e dados do vendedor
        const result = await pool.query(`
            SELECT 
                l.id, l.title, l.price, l.description, l.image_url, l.seller_id,
                u.name as seller_name, u.phone as seller_phone, u.address as seller_address,
                u.is_verified as seller_verified
            FROM marketplace_listings l
            JOIN users u ON l.seller_id = u.id
            WHERE l.id = $1 AND l.status = 'ACTIVE'
        `, [listingId]);

        if (result.rows.length === 0) {
            return c.json({ success: false, message: 'Anúncio não encontrado ou já vendido.' }, 404);
        }

        const listing = result.rows[0];

        // Não pode contatar a si mesmo
        if (listing.seller_id === user.id) {
            return c.json({ success: false, message: 'Este é seu próprio anúncio.' }, 400);
        }

        // --- LÓGICA DE CONSUMO DE PONTOS (FARM) ---
        // Verificamos se o usuário já desbloqueou este contato antes para não cobrar duas vezes
        const alreadyContacted = await pool.query(
            'SELECT 1 FROM marketplace_contacts WHERE listing_id = $1 AND buyer_id = $2',
            [listingId, user.id]
        );

        const POINT_COST = 3;

        if (alreadyContacted.rows.length === 0) {
            // Verificar se tem pontos suficientes (ad_points)
            const userPointsRes = await pool.query('SELECT ad_points FROM users WHERE id = $1', [user.id]);
            const currentPoints = userPointsRes.rows[0]?.ad_points || 0;

            if (currentPoints < POINT_COST) {
                return c.json({
                    success: false,
                    message: `Saldo insuficiente. Você precisa de ${POINT_COST} pontos de farm para ver o contato. Faça check-in diário ou assista vídeos para ganhar mais!`,
                    data: { currentPoints, required: POINT_COST }
                }, 403);
            }

            // Deduzir pontos
            await pool.query(
                'UPDATE users SET ad_points = ad_points - $1 WHERE id = $2',
                [POINT_COST, user.id]
            );

            // Registrar interesse (para não cobrar novamente e analytics)
            await pool.query(
                'INSERT INTO marketplace_contacts (listing_id, buyer_id, points_spent, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING',
                [listingId, user.id, POINT_COST]
            ).catch(() => {
                // Caso a coluna points_spent não exista ainda, tentamos sem ela
                pool.query('INSERT INTO marketplace_contacts (listing_id, buyer_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING', [listingId, user.id]);
            });
        }

        // Formatar telefone para link do WhatsApp
        const phoneClean = listing.seller_phone?.replace(/\D/g, '') || '';
        const whatsappLink = phoneClean ? `https://wa.me/55${phoneClean}?text=Olá! Vi seu anúncio "${listing.title}" no Cred30 por R$ ${parseFloat(listing.price).toFixed(2)}. Ainda está disponível?` : null;

        return c.json({
            success: true,
            data: {
                listing: {
                    id: listing.id,
                    title: listing.title,
                    price: parseFloat(listing.price),
                    description: listing.description,
                    image: listing.image_url
                },
                seller: {
                    name: listing.seller_name,
                    phone: listing.seller_phone,
                    address: listing.seller_address,
                    isVerified: listing.seller_verified || false
                },
                whatsapp: whatsappLink,
                disclaimer: '⚠️ Esta é uma negociação P2P direta. A Cred30 não intermedia esta transação e não oferece garantias. Combine pagamento e entrega diretamente com o vendedor.'
            }
        });

    } catch (error) {
        console.error('Contact Route Error:', error);
        return c.json({ success: false, message: 'Erro ao obter contato' }, 500);
    }
});

marketplaceRoutes.post('/buy-on-credit', authMiddleware, async (c: Context) => {
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
        // Compras parceladas exigem CPF, PIX e Telefone verificados para proteção do vendedor
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

        console.log(`[MARKETPLACE CREDIT] Vendedor ${isVerified ? 'VERIFICADO' : 'NÃO VERIFICADO'}. Comprador ${user.id} - Benefício: ${welcomeBenefit.hasDiscount ? 'ATIVO' : 'INATIVO'}, Taxa Escrow Final: ${(effectiveEscrowRate * 100).toFixed(1)}%`);

        const totalInterestRate = MARKET_CREDIT_INTEREST_RATE * installments;

        const result = await executeInTransaction(pool, async (client) => {
            const systemConfig = await lockSystemConfig(client);
            if (parseFloat(systemConfig.system_balance) < price) throw new Error('Limite diário de financiamento atingido.');

            await client.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['SOLD', listingId]);

            const deliveryStatus = buyOnCreditSchema.parse(body).deliveryType === 'COURIER_REQUEST' ? 'AVAILABLE' : 'NONE';
            const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            // Note: For credit, we don't charge the fee upfront from balance because it's financed, 
            // BUT usually delivery fee is paid upfront or included in loan used. 
            // For simplicity here: we include fee in the loan amount if requested.

            // Recalculate if fee included
            const fee = buyOnCreditSchema.parse(body).offeredDeliveryFee;
            const totalWithFee = price + fee;
            const totalAmountWithInterest = totalWithFee * (1 + totalInterestRate);

            // Calcular taxa de escrow com desconto de benefício
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

            // Se usou benefício, consumir um uso
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
});

marketplaceRoutes.post('/buy', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const { listingId, deliveryAddress, contactPhone, offlineToken, paymentMethod, deliveryType, offeredDeliveryFee } = buyListingSchema.parse(body);

        const listingResult = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1 AND status = $2', [listingId, 'ACTIVE']);
        if (listingResult.rows.length === 0) return c.json({ success: false, message: 'Item indisponível.' }, 404);

        const listing = listingResult.rows[0];
        if (listing.seller_id === user.id) return c.json({ success: false, message: 'Você não pode comprar de si mesmo.' }, 400);

        // Buscar endereço do vendedor para coleta
        const sellerRes = await pool.query('SELECT address FROM users WHERE id = $1', [listing.seller_id]);
        const finalPickupAddress = body.pickupAddress || sellerRes.rows[0]?.address || 'A combinar com o vendedor';

        const price = parseFloat(listing.price);
        const baseAmountToCharge = price + offeredDeliveryFee;

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

            console.log(`[MARKETPLACE] Vendedor ${isVerified ? 'VERIFICADO' : 'NÃO VERIFICADO'}. Comprador ${user.id} - Benefício: ${welcomeBenefit.hasDiscount ? 'ATIVO' : 'INATIVO'}, Taxa Escrow Final: ${(effectiveEscrowRate * 100).toFixed(1)}%`);

            const fee = price * effectiveEscrowRate;
            const sellerAmount = price - fee;

            const result = await executeInTransaction(pool, async (client) => {
                const balanceCheck = await lockUserBalance(client, user.id, baseAmountToCharge);
                if (!balanceCheck.success) throw new Error('Saldo insuficiente (Preço + Entrega).');

                await updateUserBalance(client, user.id, baseAmountToCharge, 'debit');
                await client.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['SOLD', listingId]);

                const deliveryStatus = deliveryType === 'COURIER_REQUEST' ? 'AVAILABLE' : 'NONE';
                const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

                const orderResult = await client.query(
                    `INSERT INTO marketplace_orders (listing_id, buyer_id, seller_id, amount, fee_amount, seller_amount, status, payment_method, delivery_address, pickup_address, contact_phone, offline_token, delivery_status, delivery_fee, pickup_code)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
                    [listingId, user.id, listing.seller_id, price, fee, sellerAmount, 'WAITING_SHIPPING', 'BALANCE', deliveryAddress, finalPickupAddress, contactPhone, offlineToken, deliveryStatus, offeredDeliveryFee, pickupCode]
                );
                const orderId = orderResult.rows[0].id;

                // Se usou benefício, consumir um uso
                if (welcomeBenefit.hasDiscount) {
                    await consumeWelcomeBenefitUse(client, user.id, 'MARKETPLACE');
                }

                await createTransaction(client, user.id, 'MARKET_PURCHASE', price, `Compra: ${listing.title}${welcomeBenefit.hasDiscount ? ' (🎁 Taxa reduzida)' : ''}`, 'APPROVED', { orderId, listingId, welcomeBenefitApplied: welcomeBenefit.hasDiscount });
                return { orderId, welcomeBenefitApplied: welcomeBenefit.hasDiscount, usesRemaining: welcomeBenefit.hasDiscount ? welcomeBenefit.usesRemaining - 1 : 0 };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);

            let successMessage = 'Compra realizada!';
            if (result.data?.welcomeBenefitApplied) {
                successMessage += ` 🎁 Taxa de ${(effectiveEscrowRate * 100).toFixed(1)}% aplicada (Benefício de Boas-Vindas). Usos restantes: ${result.data.usesRemaining}/3`;
            }

            return c.json({ success: true, message: successMessage, orderId: result.data?.orderId, welcomeBenefitApplied: result.data?.welcomeBenefitApplied });
        }

        // Pagamento Externo (PIX ou CARTÃO) - Temporariamente desativado
        // Sem gateway Asaas, pagamentos externos não estão disponíveis
        // O usuário deve depositar saldo primeiro via PIX manual
        return c.json({
            success: false,
            message: 'Pagamentos PIX/Cartão externos estão temporariamente indisponíveis. Por favor, deposite saldo na sua conta e use o saldo para comprar.'
        }, 400);

    } catch (error) {
        console.error('Buy Route Error:', error);
        return c.json({ success: false, message: 'Erro ao processar compra' }, 500);
    }
});

/**
 * Abrir Disputa (Problemas com o produto ou entrega)
 */
marketplaceRoutes.post('/order/:id/dispute', authMiddleware, async (c: Context) => {
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
});

/**
 * Confirmar recebimento (Comprador libera os fundos para o vendedor)
 */
/**
 * Cancelar Pedido (Pelo Comprador ou Vendedor)
 * Só pode cancelar se não tiver sido finalizado/completo
 */
marketplaceRoutes.post('/order/:id/cancel', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const orderId = c.req.param('id');

        // Buscar pedido
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
            // 1. Atualizar pedido para CANCELLED
            await client.query('UPDATE marketplace_orders SET status = $1, updated_at = NOW() WHERE id = $2', ['CANCELLED', orderId]);

            // 2. Colocar o anúncio como ACTIVE novamente
            await client.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['ACTIVE', order.listing_id]);

            // 3. Estornar Comprador
            if (order.payment_method === 'BALANCE') {
                await updateUserBalance(client, order.buyer_id, parseFloat(order.amount), 'credit');
                await createTransaction(client, order.buyer_id, 'MARKET_REFUND', parseFloat(order.amount), `Estorno: Pedido #${orderId} cancelado`, 'APPROVED');
            } else if (order.payment_method === 'CRED30_CREDIT') {
                // Cancelar o empréstimo (Loan) vinculado
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
});

/**
 * Avaliar Parceiro (Comprador avalia Vendedor e vice-versa)
 * Notas de -5 a 5, impactando Score
 */
marketplaceRoutes.post('/order/:id/rate', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const orderId = c.req.param('id');
        const { rating } = await c.req.json();

        if (rating < -5 || rating > 5) {
            return c.json({ success: false, message: 'Avaliação deve ser entre -5 e 5.' }, 400);
        }

        const orderRes = await pool.query('SELECT * FROM marketplace_orders WHERE id = $1', [orderId]);
        if (orderRes.rows.length === 0) return c.json({ success: false, message: 'Pedido não encontrado.' }, 404);

        const order = orderRes.rows[0];
        if (order.status !== 'COMPLETED') {
            return c.json({ success: false, message: 'Você só pode avaliar pedidos concluídos.' }, 400);
        }

        const isBuyer = order.buyer_id === user.id;
        const isSeller = order.seller_id === user.id;
        if (!isBuyer && !isSeller) return c.json({ success: false, message: 'Acesso negado.' }, 403);

        const result = await executeInTransaction(pool, async (client) => {
            const targetUserId = isBuyer ? order.seller_id : order.buyer_id;
            const columnToUpdate = isBuyer ? 'seller_rating' : 'buyer_rating';

            // Verificar se já avaliou
            if (order[columnToUpdate] !== null) {
                throw new Error('Você já avaliou esta transação.');
            }

            // 1. Registrar avaliação no pedido
            await client.query(`UPDATE marketplace_orders SET ${columnToUpdate} = $1 WHERE id = $2`, [rating, orderId]);

            // 2. Impactar Score (Rating x 10)
            const scoreImpact = rating * 10;
            const reason = isBuyer ? `Avaliação de comprador no pedido #${orderId}` : `Avaliação de vendedor no pedido #${orderId}`;
            await updateScore(client, targetUserId, scoreImpact, reason);

            return { success: true };
        });

        if (!result.success) return c.json({ success: false, message: result.error }, 400);
        return c.json({ success: true, message: 'Sua avaliação foi enviada e impactou a reputação do parceiro!' });
    } catch (error) {
        console.error('Rating Error:', error);
        return c.json({ success: false, message: 'Erro ao processar avaliação' }, 500);
    }
});

marketplaceRoutes.post('/order/:id/receive', authMiddleware, async (c: Context) => {
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

        const result = await executeInTransaction(pool, async (client) => {
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

                console.log(`[MARKETPLACE] Cota ${order.quota_id} transferida de ${order.seller_id} para ${order.buyer_id}`);

                // Atualizar Score por aquisição (vendedor ganha por saída limpa, comprador por entrada)
                await updateScore(client, order.buyer_id, 50, `Aquisição de cota-parte via mercado secundário #${order.quota_id}`);
                await updateScore(client, order.seller_id, 20, `Cessão bem-sucedida de cota-parte #${order.quota_id}`);
            }

            // 2. Liberar saldo para o vendedor (valor líquido)
            const sellerAmount = parseFloat(order.seller_amount);
            const totalFee = parseFloat(order.fee_amount || '0');

            // 2.1 Distribuir Taxa da Plataforma (25/25/25/25) para as reservas do sistema
            if (totalFee > 0) {
                const taxPart = totalFee * QUOTA_FEE_TAX_SHARE;
                const operPart = totalFee * QUOTA_FEE_OPERATIONAL_SHARE;
                const ownerPart = totalFee * QUOTA_FEE_OWNER_SHARE;
                const investPart = totalFee * QUOTA_FEE_INVESTMENT_SHARE;

                await client.query(`
                    UPDATE system_config SET 
                        total_tax_reserve = total_tax_reserve + $1,
                        total_operational_reserve = total_operational_reserve + $2,
                        total_owner_profit = total_owner_profit + $3,
                        investment_reserve = COALESCE(investment_reserve, 0) + $4
                    `, [taxPart, operPart, ownerPart, investPart]
                );
                console.log(`[MARKETPLACE_FEE] Distribuição de taxa (R$ ${totalFee.toFixed(2)}): Imposto ${taxPart}, Operações ${operPart}, Lucro ${ownerPart}, Investimento ${investPart}`);
            }

            // Verifica se tem taxa de entrega para pagar ao courier
            const courierFee = parseFloat(order.delivery_fee || '0');
            const courierId = order.courier_id;

            // Se foi no crediário, o dinheiro sai do caixa do sistema para o vendedor + courier
            if (order.payment_method === 'CRED30_CREDIT') {
                // Diminui do caixa do sistema o valor pago ao vendedor + taxa entrega
                await client.query('UPDATE system_config SET system_balance = system_balance - $1', [order.amount]); // Amount inclui o delivery_fee se for financiado
            }

            // Pagar Vendedor
            await updateUserBalance(client, order.seller_id, sellerAmount, 'credit');

            // Pagar Courier (se houver)
            // Pagar Courier (se houver) com desconto de sustentabilidade do grupo
            if (courierId && courierFee > 0) {
                const sustainabilityFee = courierFee * LOGISTICS_SUSTAINABILITY_FEE_RATE;
                const courierNetInfo = courierFee - sustainabilityFee;

                // 1. Pagar o Courier (Líquido)
                await updateUserBalance(client, courierId, courierNetInfo, 'credit');
                await createTransaction(
                    client,
                    courierId,
                    'LOGISTIC_REWARD',
                    courierNetInfo,
                    `Entrega Realizada: ${order.title}`,
                    'APPROVED',
                    { orderId, feeDeducted: sustainabilityFee }
                );

                // 2. Destinar a taxa para o sistema (Profit Pool)
                // Se o pagamento for via Balance (Saldo), o fee já está no sistema (foi debitado do comprador).
                // Se for via Crédito, o fee foi financiado (saiu do caixa do sistema para "pagar" o courier, agora parte volta).
                // Independente da orign, o sustainabilityFee deve ir para o Profit Pool.

                await client.query(
                    'UPDATE system_config SET profit_pool = profit_pool + $1',
                    [sustainabilityFee]
                );

                // Se o pagamento foi via BALANCE (Saldo), o valor total (courierFee) saiu do comprador e 'entrou' no sistema durante o Escrow.
                // Agora, pagamos 'courierNetInfo' para o Courier. A diferença (sustainabilityFee) fica no 'system_balance' e vai para o 'profit_pool'.
                // Se foi via CRÉDITO, 'system_balance' diminuiu em 'order.amount' (incluindo taxa).
                // Precisamos garantir que o 'system_balance' reflita a realidade.

                // No caso do crédito (linha 445): system_balance -= order.amount (Total Price + Fee)
                // O Courier recebe + NetFee.
                // O system_balance "ganha" o fee de volta? Não, o system_balance já contabilizou a saída total.
                // Ajuste contábil: O fee é ganho do sistema.

                // Simplificação: Apenas garantimos que o Profit Pool aumenta. O System Balance já contém os fundos se não foram pagos a ninguém.
            }

            // 3. Registrar transação no extrato do vendedor
            await createTransaction(
                client,
                order.seller_id,
                'MARKET_SALE',
                sellerAmount,
                `Venda Concluída: ${order.title}`,
                'APPROVED',
                { orderId }
            );

            return { sellerAmount };
        });

        if (!result.success) {
            return c.json({ success: false, message: result.error }, 400);
        }

        return c.json({
            success: true,
            message: 'Entrega confirmada! Saldo liberado ao vendedor.'
        });
    } catch (error) {
        console.error('Erro ao confirmar recebimento:', error);
        return c.json({ success: false, message: 'Erro ao processar liberação de fundos' }, 500);
    }
});

/**
 * Listar minhas compras e vendas
 */
marketplaceRoutes.get('/my-orders', authMiddleware, async (c: Context) => {
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
});

/**
 * Impulsionar um anúncio (Monetização)
 */
marketplaceRoutes.post('/boost', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const { listingId, paymentMethod = 'BALANCE' } = body;
        const BOOST_FEE = 5.00; // R$ 5,00 para impulsionar por 7 dias

        // 1. Buscar anúncio
        const listingRes = await pool.query(
            'SELECT * FROM marketplace_listings WHERE id = $1 AND seller_id = $2 AND status = $3',
            [listingId, user.id, 'ACTIVE']
        );
        if (listingRes.rows.length === 0) return c.json({ success: false, message: 'Anúncio não encontrado ou inválido' }, 404);
        const listing = listingRes.rows[0];

        // PAGAMENTO VIA SALDO
        if (paymentMethod === 'BALANCE') {
            const result = await executeInTransaction(pool, async (client) => {
                const balanceCheck = await lockUserBalance(client, user.id, BOOST_FEE);
                if (!balanceCheck.success) throw new Error('Saldo insuficiente para impulsionar');

                await updateUserBalance(client, user.id, BOOST_FEE, 'debit');

                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);

                await client.query(
                    'UPDATE marketplace_listings SET is_boosted = TRUE, boost_expires_at = $1 WHERE id = $2',
                    [expiresAt, listingId]
                );

                const taxPart = BOOST_FEE * 0.25;
                const operPart = BOOST_FEE * 0.25;
                const ownerPart = BOOST_FEE * 0.25;
                const investPart = BOOST_FEE * 0.25;

                await client.query(
                    `UPDATE system_config SET 
                        total_tax_reserve = total_tax_reserve + $1,
                        total_operational_reserve = total_operational_reserve + $2,
                        total_owner_profit = total_owner_profit + $3,
                        investment_reserve = investment_reserve + $4,
                        profit_pool = profit_pool + $5`,
                    [taxPart, operPart, ownerPart, investPart, 0]
                );

                await createTransaction(
                    client,
                    user.id,
                    'MARKET_BOOST',
                    BOOST_FEE,
                    `Impulsionamento de Anúncio: ${listing.title}`,
                    'APPROVED',
                    { listingId }
                );

                return { success: true };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);
            return c.json({ success: true, message: 'Seu anúncio foi impulsionado!' });
        }

        // PAGAMENTO EXTERNO (PIX/CARTÃO) - Temporariamente desativado
        return c.json({
            success: false,
            message: 'Pagamentos PIX/Cartão externos estão temporariamente indisponíveis. Por favor, deposite saldo na sua conta e use o saldo para impulsionar.'
        }, 400);

    } catch (error: any) {
        console.error('Error boosting listing:', error);
        return c.json({ success: false, message: error.message || 'Erro ao impulsionar anúncio' }, 500);
    }
});

/**
 * Logística Colaborativa ("Missões")
 */
marketplaceRoutes.get('/logistic/missions', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        const result = await pool.query(`
            SELECT o.id, o.delivery_fee, o.delivery_address, o.pickup_address, o.created_at,
                   o.contact_phone as buyer_phone,
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
});

marketplaceRoutes.post('/logistic/mission/:id/accept', authMiddleware, async (c: Context) => {
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
});

marketplaceRoutes.post('/logistic/mission/:id/pickup', authMiddleware, async (c: Context) => {
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
});

/**
 * Sincronização de Vendas Offline
 * Recebe uma lista de transações realizadas sem internet e processa.
 */
marketplaceRoutes.post('/offline/sync', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const { transactions } = syncOfflineSchema.parse(body);

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
                await executeInTransaction(pool, async (client) => {
                    // 1. Tentar debitar do comprador (Prioridade da Sincronização)
                    const balanceCheck = await lockUserBalance(client, tx.buyerId, tx.amount);
                    if (!balanceCheck.success) {
                        throw new Error(`Saldo insuficiente no comprador ${tx.buyerId}`);
                    }

                    // Determinar taxa base (Verificado 5% vs Não Verificado 26%)
                    const sellerResult = await client.query('SELECT asaas_wallet_id FROM users WHERE id = $1', [tx.sellerId]);
                    const isVerified = !!sellerResult.rows[0]?.asaas_wallet_id;
                    const baseFeeRate = isVerified ? MARKETPLACE_ESCROW_FEE_RATE : MARKETPLACE_NON_VERIFIED_FEE_RATE;

                    // Aplicar benefício de boas-vindas do COMPRADOR (se houver)
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

                    return { orderId };
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
});

/**
 * Atualizar localização GPS do Entregador (Rastreio em Tempo Real)
 */
marketplaceRoutes.post('/logistic/mission/:id/location', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const orderId = c.req.param('id');
        const { lat, lng } = await c.req.json();

        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return c.json({ success: false, message: 'Coordenadas inválidas' }, 400);
        }

        // Garantir que apenas o entregador do pedido possa atualizar
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
});

/**
 * Obter localização GPS para o Cliente (Modal estilo iFood)
 */
marketplaceRoutes.get('/order/:id/tracking', authMiddleware, async (c: Context) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);
        const orderId = c.req.param('id');

        const result = await pool.query(
            `SELECT o.id, o.status, o.courier_id, o.courier_lat, o.courier_lng, 
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

        return c.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        return c.json({ success: false, message: 'Erro ao buscar rastreio' }, 500);
    }
});

export { marketplaceRoutes };
