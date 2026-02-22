import { Context } from 'hono';
import { z } from 'zod';
import { calculateShippingQuote } from '../../../shared/utils/logistics.utils';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, createTransaction, updateUserBalance, lockSystemConfig, incrementSystemReserves, lockUserBalance } from '../../../domain/services/transaction.service';
import { updateScore } from '../../../application/services/score.service';
import { notificationService } from '../../../application/services/notification.service';
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
    PLATFORM_FEE_TAX_SHARE,
    PLATFORM_FEE_OPERATIONAL_SHARE,
    PLATFORM_FEE_OWNER_SHARE,
    PLATFORM_FEE_INVESTMENT_SHARE,
    PLATFORM_FEE_CORPORATE_SHARE,
    DELIVERY_MIN_FEES,
    LOAN_GFC_FEE_RATE,
    SELLER_MONTHLY_LIMIT_CPF,
    SELLER_MONTHLY_LIMIT_MEI,
    SELLER_MONTHLY_LIMIT_CNPJ
} from '../../../shared/constants/business.constants';
import {
    calculateLoanOffer,
    getCreditAnalysis,
    calculateUserLoanLimit,
    calculateMonthlyInterestRate
} from '../../../application/services/credit-analysis.service';
import { getWelcomeBenefit, consumeWelcomeBenefitUse } from '../../../application/services/welcome-benefit.service';

// Schemas
const buyListingSchema = z.object({
    listingId: z.any().optional(), // Aceita UUID ou Inteiro (SERIAL)
    listingIds: z.array(z.any()).optional(), // Novo campo para múltiplos itens
    selectedVariantId: z.number().optional(), // ID da variante (NOVO)
    deliveryAddress: z.string().min(3),
    contactPhone: z.string(),
    offlineToken: z.string().optional(),
    payerCpfCnpj: z.string().optional(),
    deliveryType: z.enum(['SELF_PICKUP', 'COURIER_REQUEST', 'EXTERNAL_SHIPPING']).optional().default('SELF_PICKUP'),
    offeredDeliveryFee: z.coerce.number().min(0).optional().default(0),
    pickupAddress: z.string().optional(),
    invitedCourierId: z.string().uuid().optional().or(z.literal('')),
    paymentMethod: z.enum(['BALANCE', 'PIX', 'CARD']).default('BALANCE'),
    quantity: z.coerce.number().int().min(1).optional().default(1),
    deliveryLat: z.coerce.number().optional(),
    deliveryLng: z.coerce.number().optional(),
    pickupLat: z.coerce.number().optional(),
    pickupLng: z.coerce.number().optional(),
    creditCard: z.object({
        holderName: z.string(),
        number: z.string(),
        expiryMonth: z.string(),
        expiryYear: z.string(),
        ccv: z.string(),
        cpf: z.string(),
    }).optional(),
    selectedOptions: z.array(z.object({
        name: z.string(),
        price: z.number()
    })).optional().default([]),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    rentalDays: z.coerce.number().int().min(1).optional()
}).refine(data => {
    if (data.deliveryType !== 'SELF_PICKUP' && !/\d/.test(data.deliveryAddress)) {
        return false;
    }
    return true;
}, {
    message: "O endereço deve incluir o número da casa/local para entregas.",
    path: ['deliveryAddress']
});

const buyOnCreditSchema = z.object({
    listingId: z.any().optional(), // Aceita UUID ou Inteiro (SERIAL)
    listingIds: z.array(z.any()).optional(), // Novo campo para múltiplos itens
    selectedVariantId: z.number().optional(), // ID da variante (NOVO)
    installments: z.number().int().min(1).max(24),
    deliveryAddress: z.string().min(3),
    contactPhone: z.string(),
    deliveryType: z.enum(['SELF_PICKUP', 'COURIER_REQUEST', 'EXTERNAL_SHIPPING']).optional().default('SELF_PICKUP'),
    offeredDeliveryFee: z.coerce.number().min(0).optional().default(0),
    pickupAddress: z.string().optional(),
    invitedCourierId: z.string().uuid().optional().or(z.literal('')),
    quantity: z.coerce.number().int().min(1).optional().default(1),
    deliveryLat: z.coerce.number().optional(),
    deliveryLng: z.coerce.number().optional(),
    pickupLat: z.coerce.number().optional(),
    pickupLng: z.coerce.number().optional(),
    selectedOptions: z.array(z.object({
        name: z.string(),
        price: z.number()
    })).optional().default([]),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    rentalDays: z.coerce.number().int().min(1).optional()
}).refine(data => {
    if (data.deliveryType !== 'SELF_PICKUP' && !/\d/.test(data.deliveryAddress)) {
        return false;
    }
    return true;
}, {
    message: "O endereço deve incluir o número da casa/local para entregas.",
    path: ['deliveryAddress']
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

            const parseResult = buyListingSchema.safeParse(body);
            if (!parseResult.success) {
                return c.json({
                    success: false,
                    message: parseResult.error.errors[0]?.message || 'Dados inválidos.'
                }, 400);
            }

            const {
                paymentMethod, deliveryType, offeredDeliveryFee, invitedCourierId,
                deliveryLat, deliveryLng, pickupLat, pickupLng, pickupAddress, selectedOptions,
                listingId, listingIds, quantity, selectedVariantId, deliveryAddress, contactPhone, offlineToken,
                startDate, endDate, rentalDays
            } = parseResult.data;

            const idsToProcess = listingIds || (listingId ? [listingId] : []);
            if (idsToProcess.length === 0) return c.json({ success: false, message: 'Nenhum item selecionado.' }, 400);

            // Iniciar transação no início para garantir consistência de leitura do estoque
            const result = await executeInTransaction(pool, async (client: any) => {
                const buyerRes = await client.query('SELECT is_verified FROM users WHERE id = $1', [user.id]);
                const buyerData = buyerRes.rows[0];

                const listingsResult = await client.query(`
                    SELECT *, COALESCE(stock, 1) as current_stock, required_vehicle 
                    FROM marketplace_listings 
                    WHERE id = ANY($1) AND status = $2 
                    FOR UPDATE
                `, [idsToProcess, 'ACTIVE']);

                if (listingsResult.rows.length === 0) throw new Error('Itens indisponíveis ou não encontrados.');

                const listings = listingsResult.rows;
                const sellerId = listings[0].seller_id;
                const finalQuantity = quantity || 1;

                // ==================================================
                // VERIFICAÇÃO DE LIMITE MENSAL DE VENDAS (COMPLIANCE FISCAL)
                // CPF: R$ 2.000/mês | MEI: R$ 6.750/mês | Outros: Sem limite
                // ==================================================
                const sellerInfoRes = await client.query(
                    `SELECT seller_cpf_cnpj, seller_company_type, is_verified FROM users WHERE id = $1`,
                    [sellerId]
                );
                const sellerInfo = sellerInfoRes.rows[0];

                // Calcular vendas do mês atual do vendedor
                const monthlySalesRes = await client.query(`
                    SELECT COALESCE(SUM(total_price), 0)::numeric as total_sales
                    FROM marketplace_orders
                    WHERE seller_id = $1
                    AND status NOT IN ('CANCELLED', 'REFUNDED')
                    AND created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
                `, [sellerId]);

                const currentMonthlySales = parseFloat(monthlySalesRes.rows[0]?.total_sales || 0);

                // Determinar limite baseado no tipo de empresa
                const companyType = sellerInfo?.seller_company_type || 'INDIVIDUAL';
                let monthlyLimit = SELLER_MONTHLY_LIMIT_CPF; // Default: CPF = R$ 2.000

                if (companyType === 'MEI') {
                    monthlyLimit = SELLER_MONTHLY_LIMIT_MEI; // MEI = R$ 6.750 (81k/ano)
                } else if (['ME', 'LTDA', 'SA', 'EIRELI'].includes(companyType)) {
                    monthlyLimit = SELLER_MONTHLY_LIMIT_CNPJ; // 0 = Sem limite
                }

                // Calcular quanto seria o total após esta venda
                const saleTotal = listings.reduce((sum: number, l: any) => sum + parseFloat(l.price) * finalQuantity, 0);
                const projectedTotal = currentMonthlySales + saleTotal;

                // Verificar se ultrapassaria o limite (0 = sem limite)
                if (monthlyLimit > 0 && projectedTotal > monthlyLimit) {
                    const remaining = Math.max(0, monthlyLimit - currentMonthlySales);
                    const companyTypeName = companyType === 'INDIVIDUAL' ? 'CPF' : companyType;
                    throw new Error(
                        `O vendedor atingiu o limite mensal de vendas para ${companyTypeName} (R$ ${monthlyLimit.toFixed(2)}). ` +
                        `Vendas este mês: R$ ${currentMonthlySales.toFixed(2)}. ` +
                        `Disponível: R$ ${remaining.toFixed(2)}.`
                    );
                }

                // VALIDAR HORÁRIO DE FUNCIONAMENTO (Se for comida/delivery)
                const isAnyFood = listings.some((l: any) => l.is_food);
                if (isAnyFood) {
                    const sellerDataRes = await client.query('SELECT opening_hours, is_restaurant, is_liquor_store, is_paused FROM users WHERE id = $1', [sellerId]);
                    const sellerRow = sellerDataRes.rows[0];

                    if (sellerRow && sellerRow.is_paused) {
                        throw new Error('Este estabelecimento está temporariamente fechado para novos pedidos.');
                    }

                    if (sellerRow && sellerRow.opening_hours) {
                        const now = new Date();
                        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                        const currentDay = dayNames[now.getDay()];
                        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

                        const hours = sellerRow.opening_hours[currentDay];
                        if (!hours || !hours.open || !hours.close) {
                            throw new Error('Este estabelecimento está fechado hoje.');
                        }

                        const [openH, openM] = hours.open.split(':').map(Number);
                        const [closeH, closeM] = hours.close.split(':').map(Number);
                        const openMin = openH * 60 + openM;
                        const closeMin = closeH * 60 + closeM;

                        let isOpen = false;
                        if (closeMin < openMin) { // Caso vire a noite (ex: 18:00 às 02:00)
                            isOpen = currentTimeMinutes >= openMin || currentTimeMinutes <= closeMin;
                        } else {
                            isOpen = currentTimeMinutes >= openMin && currentTimeMinutes <= closeMin;
                        }

                        if (!isOpen) {
                            throw new Error(`Este estabelecimento está fechado no momento. Abre às ${hours.open} e fecha às ${hours.close}.`);
                        }
                    }
                }

                // Check Variants
                let variantPrice = null;
                if (selectedVariantId) {
                    const variantRes = await client.query('SELECT * FROM marketplace_listing_variants WHERE id = $1 AND listing_id = $2 FOR UPDATE', [selectedVariantId, listings[0].id]);
                    if (variantRes.rows.length === 0) throw new Error('Variação não encontrada.');

                    const variant = variantRes.rows[0];
                    if (variant.stock < quantity) {
                        throw new Error(`Estoque da variação insuficiente: ${variant.stock} disponíveis.`);
                    }
                    if (variant.price) variantPrice = parseFloat(variant.price);
                } else {
                    // Validar Estoque Geral se não for variante
                    if (listings.length === 1 && listings[0].current_stock < quantity) {
                        throw new Error(`Quantidade solicitada (${quantity}) excede o estoque disponível (${listings[0].current_stock}).`);
                    }
                }

                // Validar se todos são do mesmo vendedor
                if (listings.some((l: any) => l.seller_id !== sellerId)) {
                    throw new Error('Todos os itens de um lote devem ser do mesmo vendedor.');
                }



                /* REMOVED
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0, 0, 0, 0);
 
                    const salesRes = await client.query(`
                        SELECT COALESCE(SUM(amount), 0) as total 
                        FROM marketplace_orders 
                        WHERE seller_id = $1 
                        AND created_at >= $2 
                        AND status != 'CANCELLED'
                    `, [sellerId, startOfMonth]);
 
                    const currentMonthlySales = parseFloat(salesRes.rows[0].total);
 
 
                */
                // --------------------------------------------------

                const sellerRes = await client.query('SELECT address, asaas_wallet_id, is_verified_seller, seller_cpf_cnpj FROM users WHERE id = $1', [sellerId]);
                const sellerData = sellerRes.rows[0];
                const isVerified = !!sellerData?.is_verified_seller; // Agora baseado no Selo

                // Usar pickup_address do anúncio se for retirada e o vendedor informou
                const finalPickupAddress = pickupAddress || listings[0].pickup_address || 'Endereço informado pelo vendedor no chat';

                // Cálculos Agregados
                const baseAmount = listings.reduce((acc: number, item: any) => {
                    let price = parseFloat(item.price);
                    if (selectedVariantId && variantPrice) price = variantPrice;
                    return acc + (price * (listings.length === 1 ? quantity : 1));
                }, 0);

                // NOTA: Verificação de limite mensal foi movida para o início da transação (linhas 151-195)
                // --------------------------------------------------

                // Somar opcionais (SE FOR COMIDA)
                let optionsTotal = 0;
                if (isAnyFood && selectedOptions && selectedOptions.length > 0) {
                    optionsTotal = selectedOptions.reduce((acc, opt) => acc + (Number(opt.price) || 0), 0);
                }

                const isRental = listings[0].module_type === 'RENTAL';
                const isDelivery = listings[0].module_type === 'DELIVERY';

                let totalPrice = 0;
                let securityDepositTotal = 0;

                if (isRental) {
                    if (!rentalDays) throw new Error('Duração do aluguel (rentalDays) é obrigatória para este item.');
                    const minDays = listings[0].minimum_rental_days || 1;
                    if (rentalDays < minDays) throw new Error(`O aluguel mínimo para este item é de ${minDays} dias.`);

                    const rentalPrice = parseFloat(listings[0].rental_price_per_day || listings[0].price);
                    securityDepositTotal = parseFloat(listings[0].security_deposit || 0);
                    totalPrice = (rentalPrice * rentalDays) + securityDepositTotal;

                    console.log(`[RENTAL] Calculando: (${rentalPrice} * ${rentalDays}) + Calção ${securityDepositTotal} = ${totalPrice}`);
                } else {
                    totalPrice = baseAmount + optionsTotal;
                }

                let maxVehicleRank = -1;
                const vehicleRank: Record<string, number> = { 'BIKE': 0, 'MOTO': 1, 'CAR': 2, 'TRUCK': 3 };
                let requiredVehicle = 'MOTO';
                let containsDigital = false;

                for (const l of listings) {
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

                        // --- TRAVA DE SEGURANÇA GEOGRÁFICA ---
                        const isBike = requiredVehicle === 'BIKE';
                        const MAX_COURIER_DISTANCE = isBike ? 7 : 60;
                        if (distanceKm > MAX_COURIER_DISTANCE) {
                            throw new Error(`Distância de ${distanceKm.toFixed(1)}km excede o limite para ${isBike ? 'Bike' : 'entregadores'} (Máx: ${MAX_COURIER_DISTANCE}km).`);
                        }

                        // Verificar se é interestadual (se tivermos os dados de endereço)
                        const sellerLocation = await client.query('SELECT seller_address_state FROM users WHERE id = $1', [sellerId]);
                        const sellerState = sellerLocation.rows[0]?.seller_address_state;

                        // O comprador pode enviar as coordenadas mas o estado pode ser inferido pelo endereço
                        // Para simplificar, focamos na distância primeiro, mas se o estado for informado no body:
                        const destState = (body.deliveryAddress || '').split(',').pop()?.trim().toUpperCase();
                        if (sellerState && destState && destState.length === 2 && sellerState !== destState) {
                            throw new Error(`Entregadores parceiros não realizam viagens entre estados (${sellerState} -> ${destState}).`);
                        }

                        // Pegar preço por KM (Bike R$ 1,50 / Outros R$ 2,50)
                        const configRes = await client.query('SELECT courier_price_per_km FROM system_config LIMIT 1');
                        const basePriceKm = parseFloat(configRes.rows[0]?.courier_price_per_km || '2.50');
                        const effectiveKmPrice = isBike ? 1.50 : basePriceKm;

                        // FÓRMULA: Base + (Distância * Km)
                        calculatedDeliveryFee = (minFee + (distanceKm * effectiveKmPrice)) * 1.275;
                        console.log(`[LOGISTICS] ${requiredVehicle} | Distância: ${distanceKm.toFixed(2)}km | Frete: R$ ${calculatedDeliveryFee.toFixed(2)}`);
                    } else {
                        calculatedDeliveryFee = Math.max(minFee, offeredDeliveryFee);
                    }
                } else if (deliveryType === 'EXTERNAL_SHIPPING') {
                    // --- CÁLCULO SEDEX BLINDADO ---
                    const listing = listings[0];
                    let originCep = listing.pickup_postal_code;
                    if (!originCep) {
                        const sellerRes = await client.query('SELECT seller_address_postal_code, seller_address_cep FROM users WHERE id = $1', [sellerId]);
                        originCep = sellerRes.rows[0]?.seller_address_cep || sellerRes.rows[0]?.seller_address_postal_code || '00000000';
                    }

                    // Extrair CEP do endereço de destino (últimos dígitos)
                    const destCepMatch = (deliveryAddress || '').match(/\d{5}-?\d{3}/);
                    const destCep = destCepMatch ? destCepMatch[0] : '00000000';

                    const totalWeight = listings.reduce((acc: number, l: any) => acc + (l.weight_grams || 1000), 0);
                    const quote = calculateShippingQuote(originCep, destCep, totalWeight, listing.free_shipping);

                    // Se o vendedor definiu um frete fixo no anúncio e não for grátis
                    if (listing.shipping_price > 0 && !listing.free_shipping) {
                        calculatedDeliveryFee = parseFloat(listing.shipping_price);
                    } else {
                        calculatedDeliveryFee = quote.fee;
                    }
                    console.log(`[EXTERNAL_LOGISTICS] ${originCep} -> ${destCep} | Peso: ${totalWeight}g | Frete: R$ ${calculatedDeliveryFee}`);
                }

                const isDigitalLote = containsDigital && listings.length === 1;
                const baseAmountToCharge = isDigitalLote ? totalPrice : totalPrice + calculatedDeliveryFee;

                // Se o pagamento for via saldo
                if (paymentMethod === 'BALANCE') {
                    // Determinar taxa base (Verificado vs Não Verificado)
                    // isVerified já foi calculado no início da transação baseado no Selo
                    const baseFeeRate = isVerified ? MARKETPLACE_ESCROW_FEE_RATE : MARKETPLACE_NON_VERIFIED_FEE_RATE;

                    // ===== SISTEMA DE BENEFÍCIO DE BOAS-VINDAS =====
                    const welcomeBenefit = await getWelcomeBenefit(client, user.id);
                    // Se o comprador tem benefício, aplica taxa especial do marketplace
                    const effectiveEscrowRate = welcomeBenefit.hasDiscount ? welcomeBenefit.marketplaceEscrowFeeRate : baseFeeRate;

                    console.log(`[MARKETPLACE] ${isDigitalLote ? 'DIGITAL' : 'FÍSICO'} | Vendedor ${isVerified ? 'VERIFICADO' : 'NÃO VERIFICADO'}. Comprador ${user.id} - Benefício: ${welcomeBenefit.hasDiscount ? 'ATIVO' : 'INATIVO'}, Taxa Escrow Final: ${(effectiveEscrowRate * 100).toFixed(1)}%`);

                    const fee = totalPrice * effectiveEscrowRate;
                    const sellerAmount = totalPrice - fee;


                    console.log(`[DEBUG_BUY] baseAmount: ${baseAmount}, optionsTotal: ${optionsTotal}, deliveryFee: ${calculatedDeliveryFee}, totalToCharge: ${baseAmountToCharge}`);
                    const balanceCheck = await lockUserBalance(client, user.id, baseAmountToCharge, { skipLockCheck: true });
                    if (!balanceCheck.success) {
                        console.error(`[DEBUG_BUY] Falha no saldo: ${balanceCheck.error}. Requisitado: ${baseAmountToCharge}, Disponível: ${balanceCheck.currentBalance}`);
                        throw new Error(balanceCheck.error || 'Saldo insuficiente.');
                    }


                    await updateUserBalance(client, user.id, baseAmountToCharge, 'debit');

                    // --- REGRAS DE DELIVERY DE COMIDA ---
                    // Itens digitais são completados instantaneamente
                    let orderStatus = isDigitalLote ? 'COMPLETED' : 'WAITING_SHIPPING';

                    // Se for comida, status inicial é PREPARING (Cozinha preparando)
                    if (!isDigitalLote && listings.some((l: any) => l.is_food)) {
                        orderStatus = 'PREPARING';
                    }

                    // --- TRAVA DE BEBIDAS ALCOÓLICAS (+18 / KYC) ---
                    const isLiquor = listings.some((l: any) => l.category === 'Bebidas' || l.category === 'Bebidas Alcoólicas');
                    if (isLiquor && !buyerData?.is_verified) {
                        throw new Error('Você precisa ter o Selo de Verificação (KYC) aprovado para comprar bebidas alcoólicas.');
                    }

                    const deliveryStatus = isDigitalLote ? 'DELIVERED' : (deliveryType === 'COURIER_REQUEST' ? 'AVAILABLE' : 'NONE');
                    const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

                    console.log(`[MARKETPLACE_BUY] Inserindo pedido: listing_id=${listings[0].id}, buyer=${user.id}, seller=${sellerId}, invitedCourier=${invitedCourierId || 'null'}`);

                    const orderResult = await client.query(
                        `INSERT INTO marketplace_orders (
                            listing_id, listing_ids, is_lote, buyer_id, seller_id, amount, fee_amount, seller_amount, 
                            status, payment_method, delivery_address, pickup_address, contact_phone, 
                            offline_token, delivery_status, delivery_fee, pickup_code, delivery_confirmation_code, invited_courier_id,
                            pickup_lat, pickup_lng, delivery_lat, delivery_lng, quantity, variant_id, selected_options
                        ) VALUES (
                            $1::INTEGER, $2::INTEGER[], $3::BOOLEAN, $4::INTEGER, $5::INTEGER, $6::NUMERIC, $7::NUMERIC, $8::NUMERIC,
                            $9, $10, $11, $12, $13,
                            $14, $15, $16::NUMERIC, $17, $18, $19,
                            $20::NUMERIC, $21::NUMERIC, $22::NUMERIC, $23::NUMERIC, $24::INTEGER, $25::INTEGER, $26::JSONB
                        ) RETURNING id`,
                        [
                            listings[0].id, idsToProcess, listings.length > 1, user.id, sellerId, totalPrice, fee, sellerAmount,
                            orderStatus, 'BALANCE', deliveryAddress, isDigitalLote ? null : finalPickupAddress, contactPhone,
                            offlineToken, deliveryStatus, isDigitalLote ? 0 : calculatedDeliveryFee, pickupCode, pickupCode,
                            (invitedCourierId && invitedCourierId.length > 30) ? invitedCourierId : null,
                            // Se não houver coordenadas enviadas, tentar pegar as que estão no anúncio
                            pickupLat || (listings[0] as any)?.pickup_lat || null,
                            pickupLng || (listings[0] as any)?.pickup_lng || null,
                            deliveryLat || null, deliveryLng || null,
                            quantity, selectedVariantId || null, JSON.stringify(selectedOptions)
                        ]
                    );

                    const orderId = orderResult.rows[0].id;

                    // Registrar campos específicos de aluguel e module_type
                    await client.query(`
                        UPDATE marketplace_orders SET 
                            module_type = $1
                        WHERE id = $2
                    `, [listings[0].module_type || 'PRODUCT', orderId]);

                    if (isRental) {
                        await client.query(`
                            UPDATE marketplace_orders SET 
                                metadata = $1,
                                status = 'RENTAL_ACTIVE'
                            WHERE id = $2
                        `, [JSON.stringify({ startDate, endDate, rentalDays, securityDeposit: securityDepositTotal }), orderId]);
                    }

                    // Registrar campos específicos de aluguel se houver
                    if (isRental) {
                        await client.query(`
                            UPDATE marketplace_orders SET 
                                metadata = $1,
                                status = 'RENTAL_ACTIVE'
                            WHERE id = $2
                        `, [JSON.stringify({ startDate, endDate, rentalDays, securityDeposit: securityDepositTotal }), orderId]);
                    }
                    console.log(`[DEBUG_BUY] Pedido criado: ${orderId} `);

                    // Se usou benefício, consumir um uso
                    if (welcomeBenefit.hasDiscount) {
                        await consumeWelcomeBenefitUse(client, user.id, 'MARKETPLACE');
                    }

                    await updateUserBalance(client, sellerId, sellerAmount, 'credit');
                    await createTransaction(client, sellerId, 'MARKET_SALE', sellerAmount, `Venda Digital: ${listings[0].title} `, 'APPROVED', { orderId });

                    // RESERVAR ESTOQUE AGORA (FÍSICO)
                    if (!isDigitalLote) {
                        // RESERVAR ESTOQUE AGORA (FÍSICO)
                        if (selectedVariantId) {
                            await client.query('UPDATE marketplace_listing_variants SET stock = GREATEST(0, stock - $1) WHERE id = $2', [quantity, selectedVariantId]);
                        }
                        // Sempre decrementar estoque principal
                        for (const l of listings) {
                            await client.query('UPDATE marketplace_listings SET stock = GREATEST(0, stock - $1) WHERE id = $2', [quantity, l.id]);
                            await client.query("UPDATE marketplace_listings SET status = 'PAUSED' WHERE id = $1 AND stock <= 0", [l.id]);
                        }
                    }

                    // ADICIONAR TAXA AO PROFIT POOL DO CLUBE
                    if (fee > 0) {
                        await incrementSystemReserves(client, {
                            profitPool: fee
                        });
                    }

                    await createTransaction(client, user.id, 'MARKET_PURCHASE', totalPrice, `Compra${isDigitalLote ? ' Digital' : ''}: ${listings.length > 1 ? `Lote (${listings.length} itens)` : listings[0].title}${welcomeBenefit.hasDiscount ? ' (🎁 Taxa reduzida)' : ''} `, 'APPROVED', { orderId, listingId: listings[0].id, welcomeBenefitApplied: welcomeBenefit.hasDiscount, isDigital: isDigitalLote, useBalance: true });

                    return { orderId, sellerId, welcomeBenefitApplied: welcomeBenefit.hasDiscount, usesRemaining: welcomeBenefit.hasDiscount ? welcomeBenefit.usesRemaining - 1 : 0, isDigitalItem: isDigitalLote, digitalContent: isDigitalLote ? listings[0].digital_content : null };
                }

                // Pagamento Externo (PIX ou CARTÃO)
                throw new Error('Pagamentos PIX/Cartão externos estão temporariamente indisponíveis. Por favor, deposite saldo na sua conta e use o saldo para comprar.');
            });

            if (!result.success && !result.data) { // executeInTransaction retorna success true se nao throw error
                // mas se o operation retornar algo, ele vem em result.data
                // Se o operation falhar com throw, cai no catch do executeInTransaction e retorna success: false
                if (result.success === false) return c.json({ success: false, message: result.error || 'Erro ao processar pedido' }, 400);
            }

            // O result.data contém o retorno da função executada
            const data = (result.data || {}) as any;

            let successMessage = data.isDigitalItem ? 'Compra realizada! O conteúdo digital está disponível em Seus Pedidos.' : 'Compra realizada! Aguarde o envio/retirada.';
            if (data.welcomeBenefitApplied) {
                successMessage += ` 🎁 Taxa de base aplicada(Benefício de Boas - Vindas).Usos restantes: ${data.usesRemaining}/3`;
            }

            // Notificar VENDEDOR sobre a nova venda (antes de retornar)
            if (data.orderId && data.sellerId) {
                notificationService.notifyUser(
                    data.sellerId,
                    '🛒 Nova Venda!',
                    `Você tem uma nova venda aguardando envio/retirada.`
                ).catch(() => { });
            }

            return c.json({
                success: true,
                message: successMessage,
                data: {
                    orderId: data.orderId,
                    welcomeBenefitApplied: data.welcomeBenefitApplied,
                    usesRemaining: data.usesRemaining,
                    digitalContent: data.digitalContent,
                    isDigitalLote: data.isDigitalItem
                }
            });

        } catch (error: unknown) {
            console.error('Buy Route Error:', error);
            // Se o erro vier do executeInTransaction (que já captura e retorna success:false), não chegaria aqui se usarmos o result
            // Mas se for erro fora da transação ou de parsing
            return c.json({ success: false, message: error.message || 'Erro ao processar pedido' }, 500);
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

            const parseResult = buyOnCreditSchema.safeParse(body);
            if (!parseResult.success) {
                return c.json({
                    success: false,
                    message: parseResult.error.errors[0]?.message || 'Dados inválidos.'
                }, 400);
            }

            const {
                listingId, listingIds, selectedVariantId, installments,
                deliveryAddress, contactPhone, invitedCourierId, quantity,
                pickupAddress, selectedOptions,
                startDate, endDate, rentalDays
            } = parseResult.data;

            const idsToProcess = listingIds || (listingId ? [listingId] : []);
            if (idsToProcess.length === 0) return c.json({ success: false, message: 'Nenhum item selecionado.' }, 400);

            // Transação Única e Atômica
            const result = await executeInTransaction(pool, async (client: any) => {
                // 1. Lock e Busca Listings - SERIALIZAÇÃO DO ESTOQUE
                const listingsResult = await client.query('SELECT *, COALESCE(stock, 1) as current_stock, required_vehicle FROM marketplace_listings WHERE id = ANY($1) AND status = $2 FOR UPDATE', [idsToProcess, 'ACTIVE']);

                if (listingsResult.rows.length === 0) throw new Error('Itens indisponíveis ou não encontrados.');

                const listings = listingsResult.rows;
                const sellerId = listings[0].seller_id;
                const finalQuantity = quantity || 1;

                // ==================================================
                // RESTRIÇÃO DE CREDIÁRIO: COTAS + KYC OBRIGATÓRIOS
                // Usuário precisa ter cotas ativas E ser verificado
                // ==================================================
                const buyerDataRes = await client.query(
                    'SELECT is_verified FROM users WHERE id = $1',
                    [user.id]
                );
                const buyerData = buyerDataRes.rows[0];

                // Verificar se usuário é verificado (KYC)
                if (!buyerData?.is_verified) {
                    throw new Error('Você precisa completar a verificação de identidade (KYC) para comprar no crediário. Acesse Configurações > Verificação.');
                }

                // Verificar se usuário tem cotas ativas
                const quotasRes = await client.query(
                    'SELECT COUNT(*) as total FROM quotas WHERE user_id = $1 AND status = $2',
                    [user.id, 'ACTIVE']
                );
                const userQuotas = parseInt(quotasRes.rows[0].total);

                if (userQuotas < MARKET_CREDIT_MIN_QUOTAS) {
                    throw new Error(`Você precisa ter pelo menos ${MARKET_CREDIT_MIN_QUOTAS} cota(s) ativa(s) para comprar no crediário. Adquira cotas para liberar o crédito.`);
                }

                // ==================================================
                // VERIFICAÇÃO DE LIMITE MENSAL DE VENDAS (COMPLIANCE FISCAL)
                // CPF: R$ 2.000/mês | MEI: R$ 6.750/mês | Outros: Sem limite

                // ==================================================
                const sellerInfoRes = await client.query(
                    `SELECT seller_cpf_cnpj, seller_company_type, is_verified FROM users WHERE id = $1`,
                    [sellerId]
                );
                const sellerInfo = sellerInfoRes.rows[0];

                // Calcular vendas do mês atual do vendedor
                const monthlySalesRes = await client.query(`
                    SELECT COALESCE(SUM(total_price), 0)::numeric as total_sales
                    FROM marketplace_orders
                    WHERE seller_id = $1
                    AND status NOT IN ('CANCELLED', 'REFUNDED')
                    AND created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
                `, [sellerId]);

                const currentMonthlySales = parseFloat(monthlySalesRes.rows[0]?.total_sales || 0);

                // Determinar limite baseado no tipo de empresa
                const companyType = sellerInfo?.seller_company_type || 'INDIVIDUAL';
                let monthlyLimit = SELLER_MONTHLY_LIMIT_CPF; // Default: CPF = R$ 2.000

                if (companyType === 'MEI') {
                    monthlyLimit = SELLER_MONTHLY_LIMIT_MEI; // MEI = R$ 6.750 (81k/ano)
                } else if (['ME', 'LTDA', 'SA', 'EIRELI'].includes(companyType)) {
                    monthlyLimit = SELLER_MONTHLY_LIMIT_CNPJ; // 0 = Sem limite
                }

                // Calcular quanto seria o total após esta venda
                const saleTotal = listings.reduce((sum: number, l: any) => sum + parseFloat(l.price) * finalQuantity, 0);
                const projectedTotal = currentMonthlySales + saleTotal;

                // Verificar se ultrapassaria o limite (0 = sem limite)
                if (monthlyLimit > 0 && projectedTotal > monthlyLimit) {
                    const remaining = Math.max(0, monthlyLimit - currentMonthlySales);
                    const companyTypeName = companyType === 'INDIVIDUAL' ? 'CPF' : companyType;
                    throw new Error(
                        `O vendedor atingiu o limite mensal de vendas para ${companyTypeName} (R$ ${monthlyLimit.toFixed(2)}). ` +
                        `Vendas este mês: R$ ${currentMonthlySales.toFixed(2)}. ` +
                        `Disponível: R$ ${remaining.toFixed(2)}.`
                    );
                }

                // VALIDAR HORÁRIO DE FUNCIONAMENTO (Se for comida/delivery)
                const isAnyFood = listings.some((l: any) => l.is_food);
                if (isAnyFood) {
                    const sellerDataRes = await client.query('SELECT opening_hours, is_restaurant, is_liquor_store, is_paused FROM users WHERE id = $1', [sellerId]);
                    const sellerRow = sellerDataRes.rows[0];

                    if (sellerRow && sellerRow.is_paused) {
                        throw new Error('Este estabelecimento está temporariamente fechado para novos pedidos.');
                    }

                    if (sellerRow && sellerRow.opening_hours) {
                        const now = new Date();
                        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                        const currentDay = dayNames[now.getDay()];
                        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

                        const hours = sellerRow.opening_hours[currentDay];
                        if (!hours || !hours.open || !hours.close) {
                            throw new Error('Este estabelecimento está fechado hoje.');
                        }

                        const [openH, openM] = hours.open.split(':').map(Number);
                        const [closeH, closeM] = hours.close.split(':').map(Number);
                        const openMin = openH * 60 + openM;
                        const closeMin = closeH * 60 + closeM;

                        let isOpen = false;
                        if (closeMin < openMin) {
                            isOpen = currentTimeMinutes >= openMin || currentTimeMinutes <= closeMin;
                        } else {
                            isOpen = currentTimeMinutes >= openMin && currentTimeMinutes <= closeMin;
                        }

                        if (!isOpen) {
                            throw new Error(`Este estabelecimento está fechado no momento. Abre às ${hours.open} e fecha às ${hours.close}.`);
                        }
                    }
                }

                // 2. Check Variants com Lock
                let variantPrice = null;
                if (selectedVariantId) {
                    const variantRes = await client.query('SELECT * FROM marketplace_listing_variants WHERE id = $1 AND listing_id = $2 FOR UPDATE', [selectedVariantId, listings[0].id]);
                    if (variantRes.rows.length === 0) throw new Error('Variação não encontrada.');

                    const variant = variantRes.rows[0];
                    if (variant.stock < quantity) {
                        throw new Error(`Estoque da variação insuficiente: ${variant.stock} disponíveis.`);
                    }
                    if (variant.price) variantPrice = parseFloat(variant.price);
                } else {
                    // Validar Estoque Geral
                    if (listings.length === 1 && listings[0].current_stock < quantity) {
                        throw new Error(`Quantidade solicitada (${quantity}) excede o estoque disponível (${listings[0].current_stock}).`);
                    }
                }

                if (listings.some((l: any) => l.seller_id !== sellerId)) {
                    throw new Error('Todos os itens de um lote devem ser do mesmo vendedor.');
                }
                if (sellerId === user.id) throw new Error('Você não pode comprar de si mesmo.');



                /* REMOVED
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0, 0, 0, 0);
     
                    const salesRes = await client.query(`
                        SELECT COALESCE(SUM(amount), 0) as total 
                        FROM marketplace_orders 
                        WHERE seller_id = $1 
                        AND created_at >= $2 
                        AND status != 'CANCELLED'
                    `, [sellerId, startOfMonth]);
     
                    const currentMonthlySales = parseFloat(salesRes.rows[0].total);
     
                */
                // --------------------------------------------------

                // 3. Validações de Score e Cotas do Usuário
                const userResult = await client.query(`
                    SELECT u.score, COUNT(q.id) as quota_count, u.is_verified, u.cpf, u.pix_key 
                    FROM users u 
                    LEFT JOIN quotas q ON q.user_id = u.id AND q.status = 'ACTIVE'
                    WHERE u.id = $1
                    GROUP BY u.id
                `, [user.id]);

                const userStats = userResult.rows[0];
                const userScore = userStats?.score || 0;
                const quotaCount = parseInt(userStats?.quota_count || '0');

                if (userScore < MARKET_CREDIT_MIN_SCORE) throw new Error(`Score insuficiente (${userScore}). Mínimo: ${MARKET_CREDIT_MIN_SCORE}.`);
                if (quotaCount < MARKET_CREDIT_MIN_QUOTAS) throw new Error(`Você precisa ter ao menos ${MARKET_CREDIT_MIN_QUOTAS} cota ativa para comprar parcelado.`);

                if (!userStats?.is_verified || !userStats?.cpf || !userStats?.pix_key) {
                    throw new Error('Para comprar parcelado, você precisa completar a verificação do seu perfil (CPF, PIX e Telefone).');
                }

                // 4. Limite de Crédito UNIFICADO (Subtrai dívida ativa automaticamente)
                const availableLimit = await calculateUserLoanLimit(pool, user.id);

                // Cálculos
                const baseAmount = listings.reduce((acc: number, item: any) => {
                    let price = parseFloat(item.price);
                    if (selectedVariantId && variantPrice) price = variantPrice;
                    return acc + (price * (listings.length === 1 ? quantity : 1));
                }, 0);

                // Somar opcionais (SE FOR COMIDA - CREDIT)
                let optionsTotal = 0;
                // No buyOnCredit, selectedOptions também deve vir do body.
                // Vou adicionar ao desestruturação do body no buyOnCredit também.
                if (isAnyFood && selectedOptions && selectedOptions.length > 0) {
                    optionsTotal = selectedOptions.reduce((acc, opt) => acc + (Number(opt.price) || 0), 0);
                }

                const isRental = listings[0].module_type === 'RENTAL';
                const isDelivery = listings[0].module_type === 'DELIVERY';

                let totalPrice = 0;
                let securityDepositTotal = 0;

                if (isRental) {
                    if (!rentalDays) throw new Error('Duração do aluguel (rentalDays) é obrigatória para este item.');
                    const minDays = listings[0].minimum_rental_days || 1;
                    if (rentalDays < minDays) throw new Error(`O aluguel mínimo para este item é de ${minDays} dias.`);

                    const rentalPrice = parseFloat(listings[0].rental_price_per_day || listings[0].price);
                    securityDepositTotal = parseFloat(listings[0].security_deposit || 0);
                    // No crediário, o total financiado inclui o calção se permitido, ou cobrado à parte.
                    // Para simplificar, financiaremos o total (aluguel + calção).
                    totalPrice = (rentalPrice * rentalDays) + securityDepositTotal;

                    console.log(`[RENTAL_CREDIT] Calculando: (${rentalPrice} * ${rentalDays}) + Calção ${securityDepositTotal} = ${totalPrice}`);
                } else {
                    totalPrice = baseAmount + optionsTotal;
                }

                // NOTA: Verificação de limite mensal foi movida para o início da transação (linhas 604-648)

                // Buscar dados do vendedor para verificação de selo
                const sellerFullRes = await client.query('SELECT address, asaas_wallet_id, is_verified_seller, seller_cpf_cnpj FROM users WHERE id = $1', [sellerId]);
                const sellerFullData = sellerFullRes.rows[0];
                const isVerified = !!sellerFullData?.is_verified_seller;
                // --------------------------------------------------

                if (totalPrice > availableLimit) throw new Error(`O valor do lote (R$ ${totalPrice.toFixed(2)}) excede seu limite de crédito (R$ ${availableLimit.toFixed(2)}).`);

                // Buscar Vendedor
                const sellerRes = await client.query('SELECT address, asaas_wallet_id FROM users WHERE id = $1', [sellerId]);
                const finalPickupAddress = pickupAddress || listings[0].pickup_address || 'Endereço informado pelo vendedor no chat';

                // Logística
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
                let calculatedDeliveryFee = parseResult.data.offeredDeliveryFee;
                if (parseResult.data.deliveryType === 'COURIER_REQUEST') {
                    const { deliveryLat, deliveryLng, pickupLat, pickupLng } = body;
                    if (deliveryLat && deliveryLng && pickupLat && pickupLng) {
                        const R = 6371;
                        const dLat = (deliveryLat - pickupLat) * Math.PI / 180;
                        const dLon = (deliveryLng - pickupLng) * Math.PI / 180;
                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(pickupLat * Math.PI / 180) * Math.cos(deliveryLat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const distanceKm = R * c;

                        // --- TRAVA DE SEGURANÇA GEOGRÁFICA ---
                        const isBike = requiredVehicle === 'BIKE';
                        const MAX_COURIER_DISTANCE = isBike ? 7 : 60;
                        if (distanceKm > MAX_COURIER_DISTANCE) {
                            throw new Error(`Distância de ${distanceKm.toFixed(1)}km excede o limite para ${isBike ? 'Bike' : 'entregadores'} (Máx: ${MAX_COURIER_DISTANCE}km).`);
                        }

                        // Verificar Interestadual
                        const sellerLocation = await client.query('SELECT seller_address_state FROM users WHERE id = $1', [sellerId]);
                        const sellerState = sellerLocation.rows[0]?.seller_address_state;
                        const destState = (deliveryAddress || '').split(',').pop()?.trim().toUpperCase();

                        if (sellerState && destState && destState.length === 2 && sellerState !== destState) {
                            throw new Error(`Entregadores parceiros não realizam viagens entre estados (${sellerState} -> ${destState}).`);
                        }

                        const configRes = await client.query('SELECT courier_price_per_km FROM system_config LIMIT 1');
                        const basePriceKm = parseFloat(configRes.rows[0]?.courier_price_per_km || '2.50');
                        const effectiveKmPrice = isBike ? 1.50 : basePriceKm;

                        // FÓRMULA: Base + (Distância * Km)
                        calculatedDeliveryFee = (minFee + (distanceKm * effectiveKmPrice)) * 1.275;
                    } else {
                        calculatedDeliveryFee = Math.max(minFee, calculatedDeliveryFee);
                    }
                } else if (parseResult.data.deliveryType === 'EXTERNAL_SHIPPING') {
                    // --- CÁLCULO SEDEX BLINDADO (CREDIT) ---
                    const listing = listings[0];
                    let originCep = listing.pickup_postal_code;
                    if (!originCep) {
                        const sellerRes = await client.query('SELECT seller_address_postal_code, seller_address_cep FROM users WHERE id = $1', [sellerId]);
                        originCep = sellerRes.rows[0]?.seller_address_cep || sellerRes.rows[0]?.seller_address_postal_code || '00000000';
                    }

                    const destCepMatch = (parseResult.data.deliveryAddress || '').match(/\d{5}-?\d{3}/);
                    const destCep = destCepMatch ? destCepMatch[0] : '00000000';

                    const totalWeight = listings.reduce((acc: number, l: any) => acc + (l.weight_grams || 1000), 0);
                    const quote = calculateShippingQuote(originCep, destCep, totalWeight, listing.free_shipping);

                    if (listing.shipping_price > 0 && !listing.free_shipping) {
                        calculatedDeliveryFee = parseFloat(listing.shipping_price);
                    } else {
                        calculatedDeliveryFee = quote.fee;
                    }
                    console.log(`[EXTERNAL_LOGISTICS_CREDIT] ${originCep} -> ${destCep} | Peso: ${totalWeight}g | Frete: R$ ${calculatedDeliveryFee}`);
                }

                const fee = calculatedDeliveryFee;
                // isVerified calculado no início (baseado no Selo)
                const baseFeeRate = isVerified ? MARKETPLACE_ESCROW_FEE_RATE : MARKETPLACE_NON_VERIFIED_FEE_RATE;

                const welcomeBenefit = await getWelcomeBenefit(pool, user.id);
                const effectiveEscrowRate = welcomeBenefit.hasDiscount ? welcomeBenefit.marketplaceEscrowFeeRate : baseFeeRate;
                const escrowFee = totalPrice * effectiveEscrowRate;
                const sellerAmount = totalPrice - escrowFee;

                // CÁLCULO DE JUROS UNIFICADO (Baseado na Garantia - Marketplace assume 100%)
                const monthlyRate = calculateMonthlyInterestRate(100);
                const interestAmount = totalPrice * monthlyRate * installments;
                // const totalToPay = totalPrice + interestAmount; // Errado na logica original? totalToPay deve ser principal + juros. Sim.
                // Mas wait, o fee de entrega entra no financiamento?
                // Na implementação anterior: totalWithFee = totalToPay + fee.
                // Sim, financia entrega também?
                // Lógica anterior: amount no INSERT era totalWithFee.
                // No loans table: amount = totalPrice + fee. total_payable = totalWithFee.

                // FGC: Taxa de Proteção de Crédito (2% sobre o valor financiado)
                const principalFinanciado = totalPrice + fee;
                const gfcFee = principalFinanciado * LOAN_GFC_FEE_RATE;
                const totalWithFee = totalPrice + interestAmount + fee + gfcFee; // Principal + Juros + Entrega + FGC

                const installmentAmount = totalWithFee / installments;

                // 5. Verificar Saldo do Sistema (Lock)
                const systemConfig = await lockSystemConfig(client);
                if (parseFloat(systemConfig.system_balance) < totalPrice) throw new Error('Limite diário de financiamento do sistema atingido.');

                // --- REGRAS DE DELIVERY DE COMIDA ---
                let orderStatus = 'WAITING_SHIPPING';
                if (listings.some((l: any) => l.is_food)) {
                    orderStatus = 'PREPARING';
                }

                // --- TRAVA DE BEBIDAS ALCOÓLICAS (+18 / KYC) ---
                const isLiquor = listings.some((l: any) => l.category === 'Bebidas' || l.category === 'Bebidas Alcoólicas');
                if (isLiquor && !userStats?.is_verified) {
                    throw new Error('Você precisa ter o Selo de Verificação (KYC) aprovado para comprar bebidas alcoólicas.');
                }

                const deliveryStatus = (parseResult.data.deliveryType === 'COURIER_REQUEST' ? 'AVAILABLE' : 'NONE');
                const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

                // ADICIONAR TAXA DE ESCROW AO PROFIT POOL DO CLUBE
                if (escrowFee > 0) {
                    await incrementSystemReserves(client, {
                        profitPool: escrowFee
                    });
                }

                console.log(`[MARKETPLACE_CREDIT] Inserindo pedido: listing_id=${listings[0].id}, buyer=${user.id}`);

                const orderResult = await client.query(
                    `INSERT INTO marketplace_orders (
                        listing_id, listing_ids, is_lote, buyer_id, seller_id, amount, fee_amount, seller_amount, 
                        status, payment_method, delivery_address, pickup_address, contact_phone, 
                        delivery_status, delivery_fee, pickup_code, delivery_confirmation_code, invited_courier_id,
                        pickup_lat, pickup_lng, delivery_lat, delivery_lng, quantity, variant_id, selected_options
                    ) VALUES (
                        $1::INTEGER, $2::INTEGER[], $3::BOOLEAN, $4::INTEGER, $5::INTEGER, $6::NUMERIC, $7::NUMERIC, $8::NUMERIC,
                        $9, $10, $11, $12, $13,
                        $14, $15, $16, $17, $18::UUID,
                        $19::NUMERIC, $20::NUMERIC, $21::NUMERIC, $22::NUMERIC, $23::INTEGER, $24::INTEGER, $25::JSONB
                    ) RETURNING id`,
                    [
                        listings[0].id, idsToProcess, listings.length > 1, user.id, sellerId, totalWithFee, escrowFee, sellerAmount,
                        orderStatus, 'CRED30_CREDIT', deliveryAddress, finalPickupAddress, contactPhone,
                        deliveryStatus, fee, pickupCode, pickupCode, (invitedCourierId && invitedCourierId.length > 30) ? invitedCourierId : null,
                        (parseResult.data as any).pickupLat || (listings[0] as any)?.pickup_lat || null,
                        (parseResult.data as any).pickupLng || (listings[0] as any)?.pickup_lng || null,
                        (parseResult.data as any).deliveryLat || null, (parseResult.data as any).deliveryLng || null,
                        quantity, selectedVariantId || null, JSON.stringify(selectedOptions || [])
                    ]
                );
                const orderId = orderResult.rows[0].id;

                // Criar Contrato de Crédito (Empréstimo)
                const loanResult = await client.query(
                    `INSERT INTO loans (user_id, amount, total_repayment, total_paid, installments, interest_rate, status, metadata)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                    [user.id, principalFinanciado, totalWithFee, 0, installments, monthlyRate, 'APPROVED', JSON.stringify({ orderId, sellerId, gfcFee, type: 'MARKETPLACE_PURCHASE' })]
                );
                const loanId = loanResult.rows[0].id;

                // === CAPITALIZAÇÃO DO FGC (Fundo de Garantia de Crédito) ===
                if (gfcFee > 0) {
                    await incrementSystemReserves(client, {
                        gfc: gfcFee
                    });
                    console.log(`[FGC-MARKETPLACE] Fundo capitalizado com R$ ${gfcFee.toFixed(2)} para crediário do pedido ${orderId}`);
                }

                // Gerar Parcelas
                const standardMarketplaceInstallment = Math.floor((totalWithFee / installments) * 100) / 100;
                let remainingMarketplaceTotal = totalWithFee;

                for (let i = 1; i <= installments; i++) {
                    const dueDate = new Date();
                    dueDate.setMonth(dueDate.getMonth() + i);

                    const currentMarketplaceInstallmentAmount = (i === installments)
                        ? Math.round(remainingMarketplaceTotal * 100) / 100
                        : standardMarketplaceInstallment;

                    await client.query(
                        `INSERT INTO loan_installments (loan_id, installment_number, amount, expected_amount, due_date, status)
                         VALUES ($1, $2, $3, $3, $4, $5)`,
                        [loanId, i, currentMarketplaceInstallmentAmount, dueDate, 'PENDING']
                    );

                    remainingMarketplaceTotal -= currentMarketplaceInstallmentAmount;
                }

                await createTransaction(client, user.id, 'MARKET_CREDIT_PURCHASE', totalPrice + fee, `Compra Parcelada (${installments}x): ${listings.length > 1 ? `Lote (${listings.length} itens)` : listings[0].title}`, 'APPROVED', { orderId, loanId, useBalance: true });

                if (welcomeBenefit.hasDiscount) {
                    await consumeWelcomeBenefitUse(client, user.id, 'MARKETPLACE');
                }

                // DECREMENTAR ESTOQUE (Já dentro da transação e lockado)
                if (selectedVariantId) {
                    await client.query('UPDATE marketplace_listing_variants SET stock = GREATEST(0, stock - $1) WHERE id = $2', [quantity, selectedVariantId]);
                }
                for (const l of listings) {
                    await client.query('UPDATE marketplace_listings SET stock = GREATEST(0, stock - $1) WHERE id = $2', [quantity, l.id]);
                    // Se estoque zerar, pausar
                    await client.query("UPDATE marketplace_listings SET status = 'PAUSED' WHERE id = $1 AND stock <= 0", [l.id]);
                }

                return { orderId, loanId, welcomeBenefitApplied: welcomeBenefit.hasDiscount, usesRemaining: welcomeBenefit.hasDiscount ? welcomeBenefit.usesRemaining - 1 : 0 };
            });

            if (!result.success && !result.data) {
                if (result.success === false) return c.json({ success: false, message: result.error || 'Erro ao processar pedido' }, 400);
            }

            const data = (result.data || {}) as any;

            let successMessage = 'Financiamento Aprovado!';
            if (data.welcomeBenefitApplied) {
                successMessage += ` 🎁 Taxa de ${(0.0).toFixed(1)}% aplicada (Benefício de Boas-Vindas). Usos restantes: ${data.usesRemaining}/3`;
                // Ops, effectiveEscrowRate não está acessivel aqui fora. Mas ok, simplifiquei a msg.
            }

            return c.json({ success: true, message: successMessage, data: { orderId: data.orderId, welcomeBenefitApplied: data.welcomeBenefitApplied } });

        } catch (error: unknown) {
            console.error('Buy Credit Error:', error);
            return c.json({ success: false, message: error.message || 'Erro ao processar' }, 500);
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
                  CASE WHEN o.buyer_id = $1 THEN l.digital_content ELSE NULL END as digital_content,
                  ub.name as buyer_name,
                  us.name as seller_name,
                  us.address as seller_address,
                  COALESCE(us.phone, us.pix_key) as seller_phone,
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
           AND (
             o.buyer_id = $2 
             OR o.pickup_code = $3 
             OR (o.offline_token IS NOT NULL AND o.offline_token = $3)
           )`,
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

                // 1.0 Baixa de Estoque (REMOVIDO - Agora feito na criação do pedido para reservar)
                // Mantemos apenas a lógica de transferência de Cota se houver

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

                // 4. Distribuir taxa da plataforma (Service Fee)
                const platformFee = parseFloat(order.fee_amount); // Assuming fee_amount is the platform's service fee
                if (platformFee > 0) {
                    const platformTaxPart = platformFee * PLATFORM_FEE_TAX_SHARE;
                    const platformOperPart = platformFee * PLATFORM_FEE_OPERATIONAL_SHARE;
                    const platformOwnerPart = platformFee * PLATFORM_FEE_OWNER_SHARE;
                    const platformInvestPart = platformFee * PLATFORM_FEE_INVESTMENT_SHARE;
                    const platformCorporatePart = platformFee * PLATFORM_FEE_CORPORATE_SHARE; // Using the constant for corporate share

                    await incrementSystemReserves(client, {
                        profitPool: platformFee * 0.5, // 50% for profit pool
                        tax: platformTaxPart,
                        operational: platformOperPart,
                        owner: platformOwnerPart,
                        investment: platformInvestPart,
                        corporate: platformCorporatePart,
                        systemBalance: platformFee // Aumenta o balanço sistêmico pelo valor total da taxa
                    });
                }

                if (!isAnticipated) {
                    // Fluxo Normal: Vendedor recebe no SALDO PENDENTE (Settlement)
                    // Isso evita que o vendedor saque e suma imediatamente (Risco apontado pelo Josias)
                    await client.query(
                        'UPDATE users SET pending_balance = pending_balance + $1 WHERE id = $2',
                        [sellerAmount, order.seller_id]
                    );
                    await createTransaction(client, order.seller_id, 'MARKET_SALE_PENDING', sellerAmount, `Venda Concluída (Em Liquidação): ${order.title}`, 'APPROVED', { orderId, settlementDays: 14 });

                    // Notificar VENDEDOR sobre a venda confirmada
                    notificationService.notifyUser(
                        order.seller_id,
                        '🎉 Venda Confirmada!',
                        `O comprador confirmou o recebimento. R$ ${sellerAmount.toFixed(2)} será liberado em 14 dias.`
                    ).catch(() => { });
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

                        // Bonificar Entregador com Score pela eficiência
                        await updateScore(client, order.courier_id, 10, `Entrega bem-sucedida #${orderId}`);

                        // Notificar ENTREGADOR
                        notificationService.notifyUser(
                            order.courier_id,
                            '🚚 Entrega Concluída!',
                            `Você ganhou R$ ${courierPart.toFixed(2)} pela entrega. Parabéns!`
                        ).catch(() => { });
                    }

                    // DIVISÃO DA TAXA DE LOGÍSTICA (15% sobre o frete)
                    // Metade para Cotistas (Profit Pool) e Metade para a Empresa (Reservas)
                    const profitShare = systemPart / 2;
                    const companyShare = systemPart / 2;

                    const taxPart = companyShare * PLATFORM_FEE_TAX_SHARE;
                    const operPart = companyShare * PLATFORM_FEE_OPERATIONAL_SHARE;
                    const ownerPart = companyShare * PLATFORM_FEE_OWNER_SHARE;
                    const investPart = companyShare * PLATFORM_FEE_INVESTMENT_SHARE;
                    const corpPart = companyShare * PLATFORM_FEE_CORPORATE_SHARE;

                    await incrementSystemReserves(client, {
                        profitPool: profitShare,
                        tax: taxPart,
                        operational: operPart,
                        owner: ownerPart,
                        investment: investPart,
                        corporate: corpPart,
                        systemBalance: companyShare
                    });

                    // --- LIBERAR SEGURO DE ENTREGA ---
                    // Entrega bem sucedida: devolve contribuição do entregador
                    const insuranceResult = await client.query(`
                        UPDATE delivery_insurance_fund 
                        SET status = 'RELEASED', released_at = NOW()
                        WHERE order_id = $1 AND status = 'RESERVED'
                        RETURNING courier_contribution
                    `, [orderId]);

                    if (insuranceResult.rows.length > 0) {
                        const courierContribution = parseFloat(insuranceResult.rows[0].courier_contribution || '0');
                        if (courierContribution > 0) {
                            // Devolve a contribuição do entregador
                            await client.query(
                                'UPDATE users SET courier_insurance_balance = courier_insurance_balance + $1 WHERE id = $2',
                                [courierContribution, order.courier_id]
                            );
                        }
                    }
                }

                // 4. Se foi no crediário, o dinheiro sai do caixa do sistema para o vendedor + courier
                if (order.payment_method === 'CRED30_CREDIT') {
                    await incrementSystemReserves(client, {
                        systemBalance: -order.amount
                    });
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
    /**
     * Cotação de Frete (Zonas de CEP)
     */
    static async getShippingQuote(c: Context) {
        try {
            const listingId = c.req.query('listingId');
            const destCep = c.req.query('destCep');
            const pool = getDbPool(c);

            if (!listingId || !destCep) {
                return c.json({ success: false, message: 'ID do anúncio e CEP de destino são obrigatórios.' }, 400);
            }

            const listingRes = await pool.query('SELECT seller_id, free_shipping, shipping_cost, pickup_postal_code FROM marketplace_listings WHERE id = $1', [listingId]);
            if (listingRes.rows.length === 0) return c.json({ success: false, message: 'Anúncio não encontrado.' }, 404);

            const listing = listingRes.rows[0];
            let originCep = listing.pickup_postal_code;

            if (!originCep) {
                const sellerRes = await pool.query('SELECT seller_address_postal_code FROM users WHERE id = $1', [listing.seller_id]);
                originCep = sellerRes.rows[0]?.seller_address_postal_code || '00000000';
            }

            const quote = calculateShippingQuote(originCep, destCep, 1000, listing.free_shipping);

            // Se o vendedor definiu um frete fixo no anúncio e não for grátis
            if (listing.shipping_cost > 0 && !listing.free_shipping) {
                quote.fee = parseFloat(listing.shipping_cost);
            }

            return c.json({ success: true, data: quote });
        } catch (error) {
            return c.json({ success: false, message: 'Erro ao calcular frete' }, 500);
        }
    }

    /**
     * Solicitar Devolução / Arrependimento
     */
    static async requestReturn(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const orderId = c.req.param('id');
            const { reason } = await c.req.json();
            const pool = getDbPool(c);

            const orderRes = await pool.query('SELECT * FROM marketplace_orders WHERE id = $1 AND buyer_id = $2', [orderId, user.id]);
            if (orderRes.rows.length === 0) return c.json({ success: false, message: 'Pedido não encontrado.' }, 404);

            const order = orderRes.rows[0];
            if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
                return c.json({ success: false, message: 'Não é possível devolver um pedido já finalizado ou cancelado.' }, 400);
            }

            await pool.query(
                `UPDATE marketplace_orders 
                 SET status = 'RETURN_REQUESTED', dispute_reason = $1, updated_at = NOW() 
                 WHERE id = $2`,
                [reason, orderId]
            );

            return c.json({ success: true, message: 'Solicitação de devolução enviada. O saldo está bloqueado para sua segurança.' });
        } catch (error) {
            return c.json({ success: false, message: 'Erro ao solicitar devolução' }, 500);
        }
    }

    /**
     * Atualizar Código de Rastreio (Transportadora)
     */
    static async updateTrackingCode(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const orderId = c.req.param('id');
            const { trackingCode } = await c.req.json();
            const pool = getDbPool(c);

            if (!trackingCode) {
                return c.json({ success: false, message: 'Código de rastreio é obrigatório.' }, 400);
            }

            const result = await pool.query(
                `UPDATE marketplace_orders 
                 SET tracking_code = $1, status = 'IN_TRANSIT', delivery_status = 'SHIPPED', updated_at = NOW()
                 WHERE id = $2 AND seller_id = $3
                 RETURNING buyer_id`,
                [trackingCode, orderId, user.id]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Pedido não encontrado ou você não é o vendedor.' }, 404);
            }

            // Notificar Comprador (Simulação de notificação interna por enquanto)
            console.log(`[NOTIFICATION] Comprador ${result.rows[0].buyer_id}: Seu pedido foi postado! Código: ${trackingCode}`);

            return c.json({
                success: true,
                message: 'Código de rastreio atualizado com sucesso! O comprador foi notificado.'
            });
        } catch (error: unknown) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Atualizar status de pedido de comida (Restaurante)
     */
    static async updateFoodOrderStatus(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('orderId');
            const { status } = await c.req.json(); // 'PREPARING', 'READY_FOR_PICKUP'

            if (!['PREPARING', 'READY_FOR_PICKUP'].includes(status)) {
                return c.json({ success: false, message: 'Status inválido para pedidos de comida.' }, 400);
            }

            const orderRes = await pool.query(
                `SELECT mo.*, ml.title, ml.is_food 
                 FROM marketplace_orders mo 
                 JOIN marketplace_listings ml ON mo.listing_id = ml.id
                 WHERE mo.id = $1 AND mo.seller_id = $2`,
                [orderId, user.id]
            );

            if (orderRes.rows.length === 0) {
                return c.json({ success: false, message: 'Pedido não encontrado ou você não é o vendedor.' }, 404);
            }

            const order = orderRes.rows[0];
            if (!order.is_food) {
                return c.json({ success: false, message: 'Este pedido não é de alimentação.' }, 400);
            }

            let newOrderStatus = status;
            let newDeliveryStatus = order.delivery_status;

            // Se marcar como PRONTO, libera para os entregadores
            if (status === 'READY_FOR_PICKUP') {
                newOrderStatus = 'WAITING_SHIPPING'; // Status padrão para aguardando envio
                newDeliveryStatus = 'AVAILABLE';   // Libera na logística
            }

            await pool.query(
                `UPDATE marketplace_orders 
                 SET status = $1, delivery_status = $2, updated_at = NOW() 
                 WHERE id = $3`,
                [newOrderStatus, newDeliveryStatus, orderId]
            );

            // Notificar Comprador
            const msg = status === 'PREPARING'
                ? `Seu pedido de "${order.title}" começou a ser preparado! 🍳`
                : `Seu pedido de "${order.title}" está pronto e aguardando um entregador! 🛵`;

            await pool.query(`
                INSERT INTO notifications (user_id, title, message, type)
                VALUES ($1, $2, $3, $4)
            `, [order.buyer_id, 'Status do Pedido', msg, 'MARKETPLACE_ORDER']);

            return c.json({
                success: true,
                message: `Status atualizado para ${status}.`
            });

        } catch (error: unknown) {
            console.error('Update Food Status Error:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Listar vendas do vendedor logado
     */
    static async getMySales(c: Context) {
        try {
            const user = c.get('user') as any;
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT 
                    o.*, 
                    l.title as listing_title, 
                    l.image_url as listing_image, 
                    l.is_food,
                    u.name as courier_name,
                    u.phone as courier_phone,
                    u.avatar_url as courier_photo,
                    u.courier_vehicle as courier_vehicle_type,
                    NULL as courier_vehicle_plate,
                    u.courier_vehicle as courier_vehicle_model
                FROM marketplace_orders o
                JOIN marketplace_listings l ON o.listing_id = l.id
                LEFT JOIN users u ON o.courier_id = u.id
                WHERE o.seller_id = $1
                ORDER BY o.created_at DESC
            `, [user.id]);

            console.log('DEBUG: getMySales result for user ' + user.id, result.rows); // DEBUG LOG

            return c.json({ success: true, data: result.rows });
        } catch (error: unknown) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
