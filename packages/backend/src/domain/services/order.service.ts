import { Pool, PoolClient } from 'pg';
import {
    MARKETPLACE_ESCROW_FEE_RATE,
    MARKETPLACE_NON_VERIFIED_FEE_RATE,
    PLATFORM_FEE_TAX_SHARE,
    PLATFORM_FEE_OPERATIONAL_SHARE,
    PLATFORM_FEE_OWNER_SHARE,
    PLATFORM_FEE_INVESTMENT_SHARE,
    PLATFORM_FEE_CORPORATE_SHARE
} from '../../shared/constants/business.constants';
import { AuditService, AuditActionType } from '../../application/services/audit.service';
import { calculateShippingQuote } from '../../shared/utils/logistics.utils';
import { notificationService } from '../../application/services/notification.service';
import { updateScore, SCORE_REWARDS } from '../../application/services/score.service';
import { lockUserBalance, updateUserBalance, createTransaction } from './transaction.service';
import { calculateLoanOffer } from '../../application/services/credit-analysis.service';

export interface CreateOrderParams {
    userId: number | string;
    listingIds: number[];
    quantity: number;
    deliveryType: 'SELF_PICKUP' | 'COURIER_REQUEST' | 'EXTERNAL_SHIPPING';
    offeredDeliveryFee: number;
    deliveryAddress: string;
    contactPhone: string;
    paymentMethod: 'BALANCE' | 'PIX' | 'CARD' | 'CRED30_CREDIT';
    selectedVariantId?: number;
    selectedOptions?: Array<{ name: string; price: number }>;
    pickupAddress?: string;
    deliveryLat?: number;
    deliveryLng?: number;
    pickupLat?: number;
    pickupLng?: number;
    invitedCourierId?: string;
    offlineToken?: string;
}

export class OrderService {
    /**
     * Valida o horário de funcionamento de um vendedor
     */
    static async validateOpeningHours(client: PoolClient, sellerId: number) {
        const sellerRes = await client.query(
            'SELECT opening_hours, is_paused, is_restaurant FROM users WHERE id = $1',
            [sellerId]
        );
        const seller = sellerRes.rows[0];

        if (seller?.is_paused) {
            throw new Error('Este estabelecimento está temporariamente fechado.');
        }

        if (seller?.opening_hours) {
            const now = new Date();
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const currentDay = dayNames[now.getDay()];
            const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

            const hours = seller.opening_hours[currentDay];
            if (!hours || !hours.open || !hours.close) {
                throw new Error('Este estabelecimento está fechado hoje.');
            }

            const [openH, openM] = hours.open.split(':').map(Number);
            const [closeH, closeM] = hours.close.split(':').map(Number);
            const openMin = openH * 60 + openM;
            const closeMin = closeH * 60 + closeM;

            let isOpen = false;
            if (closeMin < openMin) { // Caso vire a noite
                isOpen = currentTimeMinutes >= openMin || currentTimeMinutes <= closeMin;
            } else {
                isOpen = currentTimeMinutes >= openMin && currentTimeMinutes <= closeMin;
            }

            if (!isOpen) {
                throw new Error(`Estabelecimento fechado. Abre às ${hours.open} e fecha às ${hours.close}.`);
            }
        }
    }

    /**
     * Calcula o frete baseado no tipo e distância/peso
     */
    static async calculateDeliveryFee(client: PoolClient, params: CreateOrderParams, listings: any[]) {
        if (params.deliveryType === 'SELF_PICKUP') return 0;

        if (params.deliveryType === 'COURIER_REQUEST') {
            if (params.deliveryLat && params.deliveryLng && params.pickupLat && params.pickupLng) {
                const R = 6371; // km
                const dLat = (params.deliveryLat - params.pickupLat) * Math.PI / 180;
                const dLon = (params.deliveryLng - params.pickupLng) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(params.pickupLat * Math.PI / 180) * Math.cos(params.deliveryLat * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distanceKm = R * c;

                const configRes = await client.query('SELECT courier_price_per_km FROM system_config LIMIT 1');
                const basePriceKm = parseFloat(configRes.rows[0]?.courier_price_per_km || '2.50');

                return (5.00 + (distanceKm * basePriceKm)) * 1.275;
            }
            return Math.max(5.00, params.offeredDeliveryFee);
        }

        if (params.deliveryType === 'EXTERNAL_SHIPPING') {
            const listing = listings[0];
            const originCep = listing.pickup_postal_code || '00000000';
            const destCepMatch = (params.deliveryAddress || '').match(/\d{5}-?\d{3}/);
            const destCep = destCepMatch ? destCepMatch[0] : '00000000';

            const totalWeight = listings.reduce((acc: number, l: any) => acc + (l.weight_grams || 1000), 0);
            const quote = calculateShippingQuote(originCep, destCep, totalWeight, listing.free_shipping);

            return listing.shipping_price > 0 && !listing.free_shipping ? parseFloat(listing.shipping_price) : quote.fee;
        }

        return 0;
    }

    /**
     * Verifica e valida limites de vendas do vendedor (CPF vs CNPJ)
     */
    static async validateSellerLimits(client: PoolClient, sellerId: number, orderAmount: number) {
        const sellerRes = await client.query(
            'SELECT seller_cpf_cnpj FROM users WHERE id = $1',
            [sellerId]
        );
        const seller = sellerRes.rows[0];

        const docClean = seller?.seller_cpf_cnpj ? seller.seller_cpf_cnpj.replace(/\D/g, '') : '';
        const isCpf = docClean.length <= 11;

        if (isCpf) {
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

            const monthlyTotal = parseFloat(salesRes.rows[0].total);
            const LIMIT_CPF = 2000.00;

            if (monthlyTotal + orderAmount > LIMIT_CPF) {
                throw new Error(`Limite mensal de R$ ${LIMIT_CPF} para CPF atingido. Atualize para CNPJ.`);
            }
        }
    }

    /**
     * Processa a criação de um pedido no Marketplace
     */
    static async createOrder(client: PoolClient, params: CreateOrderParams) {
        // 1. Buscar Listagens
        const listingsRes = await client.query(
            'SELECT * FROM marketplace_listings WHERE id = ANY($1) AND status = $2 FOR UPDATE',
            [params.listingIds, 'ACTIVE']
        );

        if (listingsRes.rows.length === 0) {
            throw new Error('Itens indisponíveis.');
        }

        const listings = listingsRes.rows;
        const sellerId = listings[0].seller_id;

        // 2. Validações de Negócio
        await this.validateOpeningHours(client, sellerId);

        // 3. Cálculo de Preço
        let baseAmount = 0;
        for (const listing of listings) {
            let price = parseFloat(listing.price);

            // Validar variante se houver
            if (params.selectedVariantId && listing.id === params.listingIds[0]) {
                const variantRes = await client.query(
                    'SELECT price, stock FROM marketplace_listing_variants WHERE id = $1 FOR UPDATE',
                    [params.selectedVariantId]
                );
                if (variantRes.rows.length === 0) throw new Error('Variação não encontrada.');
                if (variantRes.rows[0].stock < params.quantity) throw new Error('Estoque insuficiente na variação.');
                price = parseFloat(variantRes.rows[0].price);
            } else if (listing.stock !== null && listing.stock < params.quantity) {
                throw new Error(`Estoque insuficiente para ${listing.title}.`);
            }

            baseAmount += price * (listings.length === 1 ? params.quantity : 1);
        }

        const optionsTotal = params.selectedOptions?.reduce((acc, opt) => acc + (opt.price || 0), 0) || 0;
        const totalPrice = baseAmount + optionsTotal;

        // 4. Validar limites do vendedor
        await this.validateSellerLimits(client, sellerId, totalPrice);

        // 5. Retenção de Taxas (Escrow)
        const sellerRes = await client.query('SELECT is_verified_seller FROM users WHERE id = $1', [sellerId]);
        const isVerified = !!sellerRes.rows[0].is_verified_seller;
        const feeRate = isVerified ? MARKETPLACE_ESCROW_FEE_RATE : MARKETPLACE_NON_VERIFIED_FEE_RATE;

        // 6. Benefício de Boas-Vindas
        const welcomeRes = await client.query('SELECT welcome_benefit_uses FROM users WHERE id = $1', [params.userId]);
        const welcomeUses = welcomeRes.rows[0]?.welcome_benefit_uses || 0;
        const hasWelcomeDiscount = welcomeUses < 3;
        const effectiveEscrowRate = hasWelcomeDiscount ? 0.05 : feeRate; // 5% se tiver benefício

        const platformFee = totalPrice * effectiveEscrowRate;
        const sellerNet = totalPrice - platformFee;

        // 7. Saldo e Travas
        const deliveryFee = params.deliveryType === 'COURIER_REQUEST' ? params.offeredDeliveryFee : 0;
        const totalToCharge = totalPrice + deliveryFee;

        const balanceCheck = await lockUserBalance(client, params.userId.toString(), totalToCharge, { skipLockCheck: true });
        if (!balanceCheck.success) throw new Error(balanceCheck.error || 'Saldo insuficiente.');

        await updateUserBalance(client, params.userId.toString(), totalToCharge, 'debit');

        // 8. Criar Pedido
        const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
        const deliveryCode = Math.floor(100000 + Math.random() * 900000).toString();

        const orderRes = await client.query(`
            INSERT INTO marketplace_orders (
                buyer_id, seller_id, amount, status, platform_fee, seller_net,
                delivery_type, delivery_address, contact_phone, quantity,
                pickup_code, delivery_confirmation_code, delivery_fee,
                metadata, created_at, payment_method
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), 'BALANCE')
            RETURNING id
        `, [
            params.userId, sellerId, totalPrice, 'PAYMENT_CONFIRMED', platformFee, sellerNet,
            params.deliveryType, params.deliveryAddress, params.contactPhone, params.quantity,
            pickupCode, deliveryCode, deliveryFee,
            JSON.stringify({
                listingIds: params.listingIds,
                selectedVariantId: params.selectedVariantId,
                selectedOptions: params.selectedOptions,
                invitedCourierId: params.invitedCourierId,
                pickupAddress: params.pickupAddress,
                welcomeBenefitApplied: hasWelcomeDiscount
            })
        ]);

        const orderId = orderRes.rows[0].id;

        // 9. Financeiro e Transações
        await updateUserBalance(client, sellerId.toString(), sellerNet, 'credit');

        await createTransaction(
            client,
            params.userId.toString(),
            'MARKET_PURCHASE',
            totalToCharge,
            `Compra: ${listings[0].title}`,
            'APPROVED',
            { orderId, useBalance: true }
        );

        await createTransaction(
            client,
            sellerId.toString(),
            'MARKET_SALE',
            sellerNet,
            `Venda: ${listings[0].title}`,
            'APPROVED',
            { orderId }
        );

        // 10. Atualizar Estoque
        if (params.selectedVariantId) {
            await client.query(
                'UPDATE marketplace_listing_variants SET stock = GREATEST(0, stock - $1) WHERE id = $2',
                [params.quantity, params.selectedVariantId]
            );
        }
        for (const l of listings) {
            await client.query(
                'UPDATE marketplace_listings SET stock = GREATEST(0, stock - $1) WHERE id = $2',
                [params.quantity, l.id]
            );
        }

        // 11. Bônus e Notificações (Async)
        if (hasWelcomeDiscount) {
            await client.query('UPDATE users SET welcome_benefit_uses = welcome_benefit_uses + 1 WHERE id = $1', [params.userId]);
        }

        await updateScore(client, params.userId.toString(), (SCORE_REWARDS as any).MARKETPLACE_PURCHASE || 10, 'Compra no Marketplace');

        return { orderId, totalPrice, platformFee, sellerNet, hasWelcomeDiscount };
    }

    /**
     * Processa a criação de um pedido no Marketplace via Crédito (Crediário)
     */
    static async createOrderOnCredit(client: PoolClient, params: CreateOrderParams & { installments: number }) {
        // 1. Validar Oferta de Crédito
        const listingsRes = await client.query(
            'SELECT * FROM marketplace_listings WHERE id = ANY($1) AND status = $2 FOR UPDATE',
            [params.listingIds, 'ACTIVE']
        );
        if (listingsRes.rows.length === 0) throw new Error('Itens indisponíveis.');

        const listings = listingsRes.rows;
        const sellerId = listings[0].seller_id;

        // Validações
        await this.validateOpeningHours(client, sellerId);

        let baseAmount = 0;
        for (const listing of listings) {
            let price = parseFloat(listing.price);
            if (params.selectedVariantId && listing.id === params.listingIds[0]) {
                const variantRes = await client.query('SELECT price, stock FROM marketplace_listing_variants WHERE id = $1 FOR UPDATE', [params.selectedVariantId]);
                if (variantRes.rows.length === 0) throw new Error('Variação não encontrada.');
                if (variantRes.rows[0].stock < params.quantity) throw new Error('Estoque insuficiente na variação.');
                price = parseFloat(variantRes.rows[0].price);
            }
            baseAmount += price * (listings.length === 1 ? params.quantity : 1);
        }

        const optionsTotal = params.selectedOptions?.reduce((acc, opt) => acc + (opt.price || 0), 0) || 0;
        const deliveryFee = params.deliveryType === 'COURIER_REQUEST' ? params.offeredDeliveryFee : 0;
        const totalPrice = baseAmount + optionsTotal + deliveryFee;

        // 2. Calcular Financiamento (Análise de Crédito)
        const offer = await calculateLoanOffer(client, params.userId.toString(), totalPrice, params.installments);
        if (!offer.isEligible) throw new Error(offer.reason || 'Crédito negado para esta compra.');

        // 3. Criar Empréstimo associado
        const loanRes = await client.query(`
            INSERT INTO loans (
                user_id, amount, interest_rate, total_repayment, status, 
                installments, metadata, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING id
        `, [
            params.userId, totalPrice, offer.monthlyInterestRate, offer.totalRepayment, 'APPROVED',
            params.installments, JSON.stringify({ type: 'MARKETPLACE', listingIds: params.listingIds })
        ]);

        const loanId = loanRes.rows[0].id;

        // 4. Benefício de Boas-Vindas (Marketplace Fee)
        const welcomeRes = await client.query('SELECT welcome_benefit_uses FROM users WHERE id = $1', [params.userId]);
        const hasWelcomeDiscount = (welcomeRes.rows[0]?.welcome_benefit_uses || 0) < 3;
        const feeRate = hasWelcomeDiscount ? 0.05 : MARKETPLACE_ESCROW_FEE_RATE;

        const platformFee = (totalPrice - deliveryFee) * feeRate;
        const sellerNet = (totalPrice - deliveryFee) - platformFee;

        // 5. Criar Pedido
        const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
        const deliveryCode = Math.floor(100000 + Math.random() * 900000).toString();

        const orderRes = await client.query(`
            INSERT INTO marketplace_orders (
                buyer_id, seller_id, amount, status, platform_fee, seller_net,
                delivery_type, delivery_address, contact_phone, quantity,
                pickup_code, delivery_confirmation_code, delivery_fee,
                metadata, created_at, payment_method
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), 'CRED30_CREDIT')
            RETURNING id
        `, [
            params.userId, sellerId, totalPrice, 'PAYMENT_CONFIRMED', platformFee, sellerNet,
            params.deliveryType, params.deliveryAddress, params.contactPhone, params.quantity,
            pickupCode, deliveryCode, deliveryFee,
            JSON.stringify({ orderId: 'REPLACED_LATER', loanId })
        ]);

        const orderId = orderRes.rows[0].id;
        await client.query("UPDATE loans SET metadata = metadata || $1 WHERE id = $2", [JSON.stringify({ orderId }), loanId]);

        // 6. Parcelamento
        const standardInstallment = Math.floor((offer.totalRepayment / params.installments) * 100) / 100;
        let remainingTotal = offer.totalRepayment;

        for (let i = 1; i <= params.installments; i++) {
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + i);
            const installmentAmount = (i === params.installments) ? Math.round(remainingTotal * 100) / 100 : standardInstallment;

            await client.query(`
                INSERT INTO loan_installments (loan_id, installment_number, amount, expected_amount, due_date, status)
                VALUES ($1, $2, $3, $3, $4, 'PENDING')
            `, [loanId, i, installmentAmount, dueDate]);

            remainingTotal -= installmentAmount;
        }

        // 7. Financeiro
        await updateUserBalance(client, sellerId.toString(), sellerNet, 'credit');
        await createTransaction(client, sellerId.toString(), 'MARKET_SALE', sellerNet, `Venda (Crédito): ${listings[0].title}`, 'APPROVED', { orderId, loanId });
        await createTransaction(client, params.userId.toString(), 'MARKET_CREDIT_PURCHASE', totalPrice, `Compra Parcelada (${params.installments}x): ${listings[0].title}`, 'APPROVED', { orderId, loanId });

        // 8. Estoque
        for (const l of listings) {
            await client.query('UPDATE marketplace_listings SET stock = GREATEST(0, stock - $1) WHERE id = $2', [params.quantity, l.id]);
        }

        if (hasWelcomeDiscount) {
            await client.query('UPDATE users SET welcome_benefit_uses = welcome_benefit_uses + 1 WHERE id = $1', [params.userId]);
        }

        return { orderId, loanId, totalPrice, hasWelcomeDiscount };
    }
}
