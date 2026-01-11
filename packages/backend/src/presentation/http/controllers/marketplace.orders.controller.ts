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
    QUOTA_FEE_INVESTMENT_SHARE,
    DELIVERY_MIN_FEES
} from '../../../shared/constants/business.constants';
import { calculateUserLoanLimit } from '../../../application/services/credit-analysis.service';
import { getWelcomeBenefit, consumeWelcomeBenefitUse } from '../../../application/services/welcome-benefit.service';

// Schemas
const buyListingSchema = z.object({
    listingId: z.string().uuid().optional(), // Changed to UUID and optional
    listingIds: z.array(z.string().uuid()).optional(), // New field for multiple listings
    deliveryAddress: z.string().min(5), // Updated validation and made required
    contactPhone: z.string(), // Updated validation and made required
    offlineToken: z.string().optional(),
    payerCpfCnpj: z.string().optional(),
    deliveryType: z.enum(['SELF_PICKUP', 'COURIER_REQUEST', 'EXTERNAL_SHIPPING']).optional().default('SELF_PICKUP'), // Added EXTERNAL_SHIPPING
    offeredDeliveryFee: z.number().min(0).optional().default(0),
    pickupAddress: z.string().optional(),
    invitedCourierId: z.string().uuid().optional(),
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
    listingId: z.string().uuid().optional(), // Changed to UUID and optional
    listingIds: z.array(z.string().uuid()).optional(), // New field for multiple listings
    installments: z.number().int().min(1).max(24), // Updated max installments
    deliveryAddress: z.string().min(5), // Updated validation and made required
    contactPhone: z.string(), // Updated validation and made required
    deliveryType: z.enum(['SELF_PICKUP', 'COURIER_REQUEST', 'EXTERNAL_SHIPPING']).optional().default('SELF_PICKUP'), // Added EXTERNAL_SHIPPING
    offeredDeliveryFee: z.number().min(0).optional().default(0),
    pickupAddress: z.string().optional(),
    invitedCourierId: z.string().uuid().optional(),
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
            const { listingId, listingIds, deliveryAddress, contactPhone, offlineToken, paymentMethod, deliveryType, offeredDeliveryFee, invitedCourierId } = buyListingSchema.parse(body);

            const idsToProcess = listingIds || (listingId ? [listingId] : []);
            if (idsToProcess.length === 0) return c.json({ success: false, message: 'Nenhum item selecionado.' }, 400);

            const listingsResult = await pool.query('SELECT *, required_vehicle FROM marketplace_listings WHERE id = ANY($1) AND status = $2', [idsToProcess, 'ACTIVE']);
            if (listingsResult.rows.length === 0) return c.json({ success: false, message: 'Itens indisponíveis.' }, 404);

            const listings = listingsResult.rows;
            const sellerId = listings[0].seller_id;

            // Validar se todos são do mesmo vendedor
            if (listings.some(l => l.seller_id !== sellerId)) {
                return c.json({ success: false, message: 'Todos os itens de um lote devem ser do mesmo vendedor.' }, 400);
            }

            const sellerRes = await pool.query('SELECT address, asaas_wallet_id FROM users WHERE id = $1', [sellerId]);
            const finalPickupAddress = body.pickupAddress || sellerRes.rows[0]?.address || 'A combinar com o vendedor';

            // Cálculos Agregados
            let totalPrice = 0;
            let maxVehicleRank = -1;
            const vehicleRank: Record<string, number> = { 'BIKE': 0, 'MOTO': 1, 'CAR': 2, 'TRUCK': 3 };
            let requiredVehicle = 'MOTO';
            let containsDigital = false;

            for (const l of listings) {
                totalPrice += parseFloat(l.price);
                const vRank = vehicleRank[l.required_vehicle || 'MOTO'] || 1;
                if (vRank > maxVehicleRank) {
                    maxVehicleRank = vRank;
                    requiredVehicle = l.required_vehicle || 'MOTO';
                }
                if (l.item_type === 'DIGITAL') containsDigital = true;
            }

            const minFee = DELIVERY_MIN_FEES[requiredVehicle] || 5.00;

            // --- CÁLCULO DE FRETE DINÂMICO (NOVO) ---
            let calculatedDeliveryFee = offeredDeliveryFee;
            if (deliveryType === 'COURIER_REQUEST') {
                const { deliveryLat, deliveryLng, pickupLat, pickupLng } = body;

                if (deliveryLat && deliveryLng && pickupLat && pickupLng) {
                    // Haversine no Backend para Cálculo de Frete
                    const R = 6371; // km
                    const dLat = (deliveryLat - pickupLat) * Math.PI / 180;
                    const dLon = (deliveryLng - pickupLng) * Math.PI / 180;
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(pickupLat * Math.PI / 180) * Math.cos(deliveryLat * Math.PI / 180) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const distanceKm = R * c;

                    // Pegar preço por KM do sistema
                    const configRes = await pool.query('SELECT courier_price_per_km FROM system_config LIMIT 1');
                    const systemBasePriceKm = parseFloat(configRes.rows[0]?.courier_price_per_km || '2.50');
                    const baseFee = distanceKm * systemBasePriceKm;

                    // Aplicar margem de 27.5% de lucro para a plataforma
                    calculatedDeliveryFee = Math.max(minFee, baseFee * 1.275);
                    console.log(`[LOGISTICS] Distância: ${distanceKm.toFixed(2)}km | Preço/KM: R$ ${systemBasePriceKm.toFixed(2)} | Frete Calculado: R$ ${calculatedDeliveryFee.toFixed(2)}`);
                } else {
                    calculatedDeliveryFee = Math.max(minFee, offeredDeliveryFee);
                }
            }

            const isDigitalLote = containsDigital && listings.length === 1;
            const baseAmountToCharge = isDigitalLote ? totalPrice : totalPrice + calculatedDeliveryFee;

            // Se o pagamento for via saldo
            if (paymentMethod === 'BALANCE') {
                // Determinar taxa base (Verificado vs Não Verificado)
                const isVerified = !!sellerRes.rows[0]?.asaas_wallet_id;
                const baseFeeRate = isVerified ? MARKETPLACE_ESCROW_FEE_RATE : MARKETPLACE_NON_VERIFIED_FEE_RATE;

                // ===== SISTEMA DE BENEFÍCIO DE BOAS-VINDAS =====
                const welcomeBenefit = await getWelcomeBenefit(pool, user.id);
                // Se o comprador tem benefício, aplica 50% de desconto sobre a taxa base
                const effectiveEscrowRate = welcomeBenefit.hasDiscount ? baseFeeRate * 0.5 : baseFeeRate;

                console.log(`[MARKETPLACE] ${isDigitalLote ? 'DIGITAL' : 'FÍSICO'} | Vendedor ${isVerified ? 'VERIFICADO' : 'NÃO VERIFICADO'}. Comprador ${user.id} - Benefício: ${welcomeBenefit.hasDiscount ? 'ATIVO' : 'INATIVO'}, Taxa Escrow Final: ${(effectiveEscrowRate * 100).toFixed(1)}%`);

                const fee = totalPrice * effectiveEscrowRate;
                const sellerAmount = totalPrice - fee;

                const result = await executeInTransaction(pool, async (client: any) => {
                    const balanceCheck = await lockUserBalance(client, user.id, baseAmountToCharge);
                    if (!balanceCheck.success) return { success: false, error: 'Saldo insuficiente.' };

                    await updateUserBalance(client, user.id, baseAmountToCharge, 'debit');

                    // Itens digitais são completados instantaneamente
                    const orderStatus = isDigitalLote ? 'COMPLETED' : 'WAITING_SHIPPING';
                    const deliveryStatus = isDigitalLote ? 'DELIVERED' : (deliveryType === 'COURIER_REQUEST' ? 'AVAILABLE' : 'NONE');
                    const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

                    const orderResult = await client.query(
                        `INSERT INTO marketplace_orders (
                            listing_id, listing_ids, is_lote, buyer_id, seller_id, amount, fee_amount, seller_amount, 
                            status, payment_method, delivery_address, pickup_address, contact_phone, 
                            offline_token, delivery_status, delivery_fee, pickup_code, invited_courier_id,
                            pickup_lat, pickup_lng, delivery_lat, delivery_lng
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING id`,
                        [
                            listings[0].id, idsToProcess, listings.length > 1, user.id, sellerId, totalPrice, fee, sellerAmount,
                            orderStatus, 'BALANCE', deliveryAddress, isDigitalLote ? null : finalPickupAddress, contactPhone,
                            offlineToken, deliveryStatus, isDigitalLote ? 0 : calculatedDeliveryFee, pickupCode, invitedCourierId,
                            body.pickupLat || null, body.pickupLng || null, body.deliveryLat || null, body.deliveryLng || null
                        ]
                    );
                    const orderId = orderResult.rows[0].id;

                    // Se usou benefício, consumir um uso
                    if (welcomeBenefit.hasDiscount) {
                        await consumeWelcomeBenefitUse(client, user.id, 'MARKETPLACE');
                    }

                    // Para itens digitais, pagar vendedor imediatamente
                    if (isDigitalLote) {
                        await updateUserBalance(client, sellerId, sellerAmount, 'credit');
                        await createTransaction(client, sellerId, 'MARKET_SALE', sellerAmount, `Venda Digital: ${listings[0].title}`, 'APPROVED', { orderId });
                    }

                    await createTransaction(client, user.id, 'MARKET_PURCHASE', totalPrice, `Compra${isDigitalLote ? ' Digital' : ''}: ${listings.length > 1 ? `Lote (${listings.length} itens)` : listings[0].title}${welcomeBenefit.hasDiscount ? ' (🎁 Taxa reduzida)' : ''}`, 'APPROVED', { orderId, listingId: listings[0].id, welcomeBenefitApplied: welcomeBenefit.hasDiscount, isDigital: isDigitalLote });

                    // Desativar anúncios
                    for (const l of listings) {
                        await client.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['SOLD', l.id]);
                    }

                    return { orderId, welcomeBenefitApplied: welcomeBenefit.hasDiscount, usesRemaining: welcomeBenefit.hasDiscount ? welcomeBenefit.usesRemaining - 1 : 0, isDigitalItem: isDigitalLote, digitalContent: isDigitalLote ? listings[0].digital_content : null };
                });

                if (!result.success || !result.data) return c.json({ success: false, message: result.error || 'Erro ao processar pedido' }, 400);

                let successMessage = result.data.isDigitalItem ? 'Compra realizada! O conteúdo digital está disponível em Seus Pedidos.' : 'Compra realizada! Aguarde o envio/retirada.';
                if (result.data.welcomeBenefitApplied) {
                    successMessage += ` 🎁 Taxa de ${(effectiveEscrowRate * 100).toFixed(1)}% aplicada (Benefício de Boas-Vindas). Usos restantes: ${result.data.usesRemaining}/3`;
                }

                return c.json({
                    success: true,
                    message: successMessage,
                    orderId: result.data?.orderId,
                    welcomeBenefitApplied: result.data?.welcomeBenefitApplied,
                    usesRemaining: result.data?.usesRemaining,
                    digitalContent: result.data?.digitalContent,
                    isDigitalLote: result.data?.isDigitalItem // Renamed key as per instruction
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
            const { listingId, listingIds, installments, deliveryAddress, contactPhone, invitedCourierId } = buyOnCreditSchema.parse(body);

            const idsToProcess = listingIds || (listingId ? [listingId] : []);
            if (idsToProcess.length === 0) return c.json({ success: false, message: 'Nenhum item selecionado.' }, 400);

            const userResult = await pool.query(`
                SELECT u.score, COUNT(q.id) as quota_count 
                FROM users u 
                LEFT JOIN quotas q ON q.user_id = u.id AND q.status = 'ACTIVE'
                WHERE u.id = $1
                GROUP BY u.id
            `, [user.id]);

            const userStats = userResult.rows[0];
            const userScore = userStats?.score || 0;
            const quotaCount = parseInt(userStats?.quota_count || '0');

            if (userScore < MARKET_CREDIT_MIN_SCORE) return c.json({ success: false, message: `Score insuficiente (${userScore}). Mínimo: ${MARKET_CREDIT_MIN_SCORE}.` }, 403);
            if (quotaCount < MARKET_CREDIT_MIN_QUOTAS) return c.json({ success: false, message: `Você precisa ter ao menos ${MARKET_CREDIT_MIN_QUOTAS} cota ativa para comprar parcelado.` }, 403);

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
            const listingsResult = await pool.query('SELECT *, required_vehicle FROM marketplace_listings WHERE id = ANY($1) AND status = $2', [idsToProcess, 'ACTIVE']);

            if (listingsResult.rows.length === 0) return c.json({ success: false, message: 'Itens indisponíveis.' }, 404);

            const listings = listingsResult.rows;
            const sellerId = listings[0].seller_id;

            if (listings.some(l => l.seller_id !== sellerId)) {
                return c.json({ success: false, message: 'Todos os itens de um lote devem ser do mesmo vendedor.' }, 400);
            }

            const totalPrice = listings.reduce((acc, l) => acc + parseFloat(l.price), 0);
            if (totalPrice > availableLimit) return c.json({ success: false, message: `O valor do lote (R$ ${totalPrice.toFixed(2)}) excede seu limite de crédito (R$ ${availableLimit.toFixed(2)}).` }, 403);

            if (sellerId === user.id) return c.json({ success: false, message: 'Você não pode comprar de si mesmo.' }, 400);

            // Buscar endereço do vendedor
            const sellerRes = await pool.query('SELECT address, asaas_wallet_id FROM users WHERE id = $1', [sellerId]);
            const finalPickupAddress = body.pickupAddress || sellerRes.rows[0]?.address || 'A combinar com o vendedor';

            // Agregação de veículo
            let maxVehicleRank = -1;
            const vehicleRank: Record<string, number> = { 'BIKE': 0, 'MOTO': 1, 'CAR': 2, 'TRUCK': 3 };
            let requiredVehicle = 'MOTO';
            for (const l of listings) {
                const vRank = vehicleRank[l.required_vehicle || 'MOTO'] || 1;
                if (vRank > maxVehicleRank) {
                    maxVehicleRank = vRank;
                    requiredVehicle = l.required_vehicle || 'MOTO';
                }
            }

            const minFee = DELIVERY_MIN_FEES[requiredVehicle] || 5.00;
            // --- CÁLCULO DE FRETE DINÂMICO NO CREDIÁRIO ---
            let calculatedDeliveryFee = buyOnCreditSchema.parse(body).offeredDeliveryFee;
            if (buyOnCreditSchema.parse(body).deliveryType === 'COURIER_REQUEST') {
                const { deliveryLat, deliveryLng, pickupLat, pickupLng } = body;
                if (deliveryLat && deliveryLng && pickupLat && pickupLng) {
                    const R = 6371;
                    const dLat = (deliveryLat - pickupLat) * Math.PI / 180;
                    const dLon = (deliveryLng - pickupLng) * Math.PI / 180;
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(pickupLat * Math.PI / 180) * Math.cos(deliveryLat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const distanceKm = R * c;

                    const configRes = await pool.query('SELECT courier_price_per_km FROM system_config LIMIT 1');
                    const systemBasePriceKm = parseFloat(configRes.rows[0]?.courier_price_per_km || '2.50');
                    calculatedDeliveryFee = Math.max(minFee, (distanceKm * systemBasePriceKm) * 1.275);
                } else {
                    calculatedDeliveryFee = Math.max(minFee, calculatedDeliveryFee);
                }
            }

            const fee = calculatedDeliveryFee;

            // Determinar taxa base (Verificado vs Não Verificado)
            const isVerified = !!sellerRes.rows[0]?.asaas_wallet_id;
            const baseFeeRate = isVerified ? MARKETPLACE_ESCROW_FEE_RATE : MARKETPLACE_NON_VERIFIED_FEE_RATE;

            const welcomeBenefit = await getWelcomeBenefit(pool, user.id);
            const effectiveEscrowRate = welcomeBenefit.hasDiscount ? baseFeeRate * 0.5 : baseFeeRate;

            const escrowFee = totalPrice * effectiveEscrowRate;
            const sellerAmount = totalPrice - escrowFee;

            // Cálculo dos Juros do Crédito
            const interestAmount = totalPrice * MARKET_CREDIT_INTEREST_RATE * installments;
            const totalToPay = totalPrice + interestAmount;
            const totalWithFee = totalToPay + fee;

            const installmentAmount = totalWithFee / installments;

            const result = await executeInTransaction(pool, async (client: any) => {
                const systemConfig = await lockSystemConfig(client);
                if (parseFloat(systemConfig.system_balance) < totalPrice) throw new Error('Limite diário de financiamento atingido.');

                const deliveryStatus = (buyOnCreditSchema.parse(body).deliveryType === 'COURIER_REQUEST' ? 'AVAILABLE' : 'NONE');
                const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

                const orderResult = await client.query(
                    `INSERT INTO marketplace_orders (
                        listing_id, listing_ids, is_lote, buyer_id, seller_id, amount, fee_amount, seller_amount, 
                        status, payment_method, delivery_address, pickup_address, contact_phone, 
                        delivery_status, delivery_fee, pickup_code, invited_courier_id,
                        pickup_lat, pickup_lng, delivery_lat, delivery_lng
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING id`,
                    [
                        listings[0].id, idsToProcess, listings.length > 1, user.id, sellerId, totalWithFee, escrowFee, sellerAmount,
                        'WAITING_SHIPPING', 'CRED30_CREDIT', deliveryAddress, finalPickupAddress, contactPhone,
                        deliveryStatus, fee, pickupCode, invitedCourierId,
                        body.pickupLat || null, body.pickupLng || null, body.deliveryLat || null, body.deliveryLng || null
                    ]
                );
                const orderId = orderResult.rows[0].id;

                // Criar Contrato de Crédito (Empréstimo)
                const loanResult = await client.query(
                    `INSERT INTO loans (user_id, amount, total_payable, total_paid, term_months, interest_rate, status, purpose, metadata)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                    [user.id, totalPrice + fee, totalWithFee, 0, installments, MARKET_CREDIT_INTEREST_RATE, 'ACTIVE', 'MARKETPLACE_PURCHASE', JSON.stringify({ orderId, sellerId })]
                );
                const loanId = loanResult.rows[0].id;

                // Gerar Parcelas
                for (let i = 1; i <= installments; i++) {
                    const dueDate = new Date();
                    dueDate.setMonth(dueDate.getMonth() + i);
                    await client.query(
                        `INSERT INTO loan_installments (loan_id, installment_number, amount, due_date, status)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [loanId, i, installmentAmount, dueDate, 'PENDING']
                    );
                }

                await createTransaction(client, user.id, 'MARKET_CREDIT_PURCHASE', totalPrice + fee, `Compra Parcelada (${installments}x): ${listings.length > 1 ? `Lote (${listings.length} itens)` : listings[0].title}`, 'APPROVED', { orderId, loanId });

                if (welcomeBenefit.hasDiscount) {
                    await consumeWelcomeBenefitUse(client, user.id, 'MARKETPLACE');
                }

                for (const l of listings) {
                    await client.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['SOLD', l.id]);
                }

                return { orderId, loanId, welcomeBenefitApplied: welcomeBenefit.hasDiscount, usesRemaining: welcomeBenefit.hasDiscount ? welcomeBenefit.usesRemaining - 1 : 0 };
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

            // Buscar pedido esperando confirmação do comprador
            // Aceita: WAITING_SHIPPING, IN_TRANSIT, ou quando entregador já marcou DELIVERED
            const orderResult = await pool.query(
                `SELECT o.*, l.title, l.quota_id FROM marketplace_orders o 
           JOIN marketplace_listings l ON o.listing_id = l.id 
           WHERE o.id = $1 
           AND (o.status IN ('WAITING_SHIPPING', 'IN_TRANSIT') OR o.delivery_status = 'DELIVERED')
           AND o.status != 'COMPLETED'
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
                    const courierPart = courierFee * 0.90; // 90% para o entregador
                    const systemPart = courierFee * 0.10;  // 10% para o sistema

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
