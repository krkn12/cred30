
import { Pool, PoolClient } from 'pg';

/**
 * Sistema de Empréstimo por Mérito com Garantia Flexível
 * 
 * REGRAS:
 * 1. LIMITE MÁXIMO = 80% do Total Gasto (sem cotas)
 * 2. Usuário escolhe % de garantia (mínimo 50% das cotas)
 * 3. Quanto MENOR a garantia, MAIOR os juros (proteção contra calote)
 * 
 * TABELA DE JUROS (baseado na garantia):
 * - 50% garantia → 35% juros
 * - 60% garantia → 28% juros
 * - 70% garantia → 22% juros
 * - 80% garantia → 18% juros
 * - 90% garantia → 14% juros
 * - 100% garantia → 10% juros
 */

// Constantes
const MIN_SCORE_FOR_LOAN = 850;
const MIN_MARKETPLACE_TRANSACTIONS = 3;
const MIN_ACCOUNT_AGE_DAYS = 30;
const SYSTEM_LIQUIDITY_RESERVE = 0.30;
const LIMIT_PERCENTAGE = 0.80; // 80% do total gasto

// Tabela de juros baseada na garantia
const INTEREST_RATES: { [key: number]: number } = {
    50: 0.35,   // 50% garantia = 35% juros
    60: 0.28,   // 60% garantia = 28% juros
    70: 0.22,   // 70% garantia = 22% juros
    80: 0.18,   // 80% garantia = 18% juros
    90: 0.14,   // 90% garantia = 14% juros
    100: 0.10,  // 100% garantia = 10% juros
};

const VALID_GUARANTEE_PERCENTAGES = [50, 60, 70, 80, 90, 100];

/**
 * Calcula a taxa de juros baseada na garantia oferecida
 */
export const calculateInterestRate = (guaranteePercentage: number): number => {
    if (guaranteePercentage <= 50) return INTEREST_RATES[50];
    if (guaranteePercentage <= 60) return INTEREST_RATES[60];
    if (guaranteePercentage <= 70) return INTEREST_RATES[70];
    if (guaranteePercentage <= 80) return INTEREST_RATES[80];
    if (guaranteePercentage <= 90) return INTEREST_RATES[90];
    return INTEREST_RATES[100];
};

/**
 * Verifica elegibilidade para empréstimo
 */
export const checkLoanEligibility = async (pool: Pool | PoolClient, userId: string): Promise<{
    eligible: boolean;
    reason?: string;
    details: {
        score: number;
        quotasCount: number;
        quotasValue: number;
        marketplaceTransactions: number;
        accountAgeDays: number;
        hasOverdue: boolean;
        totalSpent: number;
        accumulatedProfit: number;
        maxLoanAmount: number;
    }
}> => {
    try {
        // Dados do usuário, cotas e histórico
        const userDataRes = await pool.query(`
            SELECT 
                u.score, 
                u.created_at,
                -- Cotas ativas
                (SELECT COUNT(*) FROM quotas WHERE user_id = $1 AND status = 'ACTIVE') as quotas_count,
                (SELECT COALESCE(SUM(current_value), 0) FROM quotas WHERE user_id = $1 AND status = 'ACTIVE') as total_quotas_value,
                -- Transações de marketplace
                (SELECT COUNT(*) FROM marketplace_orders WHERE buyer_id = $1 AND status = 'COMPLETED') as purchases,
                (SELECT COUNT(*) FROM marketplace_orders mo JOIN marketplace_listings ml ON mo.listing_id = ml.id WHERE ml.user_id = $1 AND mo.status = 'COMPLETED') as sales,
                -- Empréstimos em atraso
                (SELECT COUNT(*) FROM loans WHERE user_id = $1 AND status = 'APPROVED' AND due_date < NOW()) as overdue_loans,
                
                -- ========================================
                -- LUCRO ACUMULADO QUE O SISTEMA TEVE COM ESSE USUÁRIO
                -- ========================================
                
                -- 1. Taxa administrativa das cotas (R$ 8 por cota comprada)
                COALESCE((SELECT COUNT(*) * 8.00 FROM quotas WHERE user_id = $1), 0) as quota_fees_profit,
                
                -- 2. Taxas quando VENDEU no marketplace (12% ou 27.5% que ficou no sistema)
                COALESCE((SELECT SUM(
                    CASE 
                        WHEN u2.asaas_wallet_id IS NOT NULL THEN mo.total_price * 0.12  -- Verificado: 12%
                        ELSE mo.total_price * 0.275  -- Não verificado: 27.5%
                    END
                ) FROM marketplace_orders mo 
                JOIN marketplace_listings ml ON mo.listing_id = ml.id 
                LEFT JOIN users u2 ON ml.user_id = u2.id
                WHERE ml.user_id = $1 AND mo.status = 'COMPLETED'), 0) as marketplace_seller_profit,
                
                -- 3. Taxas quando COMPROU no marketplace (taxa vai pro vendedor, mas frete tem 10%)
                COALESCE((SELECT SUM(COALESCE(shipping_cost, 0) * 0.10) FROM marketplace_orders WHERE buyer_id = $1 AND status = 'COMPLETED'), 0) as logistics_profit,
                
                -- 4. Taxa de originação de empréstimos anteriores (3%)
                COALESCE((SELECT SUM(amount * 0.03) FROM loans WHERE user_id = $1 AND status IN ('PAID', 'APPROVED')), 0) as loan_origination_profit,
                
                -- 5. Campanhas de vídeo (15% fica no sistema)
                COALESCE((SELECT SUM(budget_gross * 0.15) FROM promo_videos WHERE user_id = $1), 0) as video_campaign_profit,
                
                -- 6. Compras na Academy (7.5% fica no sistema)
                COALESCE((SELECT SUM(t.amount * 0.075) FROM transactions t WHERE t.user_id = $1 AND t.type = 'ACADEMY_PURCHASE' AND t.status = 'APPROVED'), 0) as academy_profit,
                
                -- 7. Upgrades, badges, score packages (100% fica no sistema como lucro)
                COALESCE((SELECT SUM(ABS(amount)) FROM transactions 
                    WHERE user_id = $1 AND status = 'APPROVED' 
                    AND type IN ('MEMBERSHIP_UPGRADE', 'BUY_VERIFIED_BADGE', 'BUY_SCORE_PACKAGE', 'MARKET_BOOST')
                ), 0) as platform_services_profit,
                
                -- Total gasto para estatísticas
                COALESCE((SELECT SUM(total_price) FROM marketplace_orders WHERE buyer_id = $1 AND status = 'COMPLETED'), 0) as marketplace_spent,
                COALESCE((SELECT SUM(budget_gross) FROM promo_videos WHERE user_id = $1), 0) as campaign_spent
            FROM users u
            WHERE u.id = $1
        `, [userId]);

        if (userDataRes.rows.length === 0) {
            return { eligible: false, reason: 'Usuário não encontrado', details: { score: 0, quotasCount: 0, quotasValue: 0, marketplaceTransactions: 0, accountAgeDays: 0, hasOverdue: false, totalSpent: 0, accumulatedProfit: 0, maxLoanAmount: 0 } };
        }

        const userData = userDataRes.rows[0];
        const score = parseInt(userData.score) || 0;
        const quotasCount = parseInt(userData.quotas_count) || 0;
        const quotasValue = parseFloat(userData.total_quotas_value) || 0;
        const marketplaceTransactions = parseInt(userData.purchases || 0) + parseInt(userData.sales || 0);
        const accountAgeDays = Math.floor((Date.now() - new Date(userData.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const hasOverdue = parseInt(userData.overdue_loans) > 0;

        // Total gasto (para estatísticas)
        const totalSpent = parseFloat(userData.marketplace_spent || 0) +
            parseFloat(userData.campaign_spent || 0) +
            parseFloat(userData.platform_services_profit || 0);

        // ========================================
        // CÁLCULO DO LUCRO ACUMULADO (RISCO ZERO)
        // ========================================
        const accumulatedProfit =
            parseFloat(userData.quota_fees_profit || 0) +           // Taxa das cotas
            parseFloat(userData.marketplace_seller_profit || 0) +   // Taxas de vendas
            parseFloat(userData.logistics_profit || 0) +            // Taxa de frete
            parseFloat(userData.loan_origination_profit || 0) +     // Taxa de empréstimos anteriores
            parseFloat(userData.video_campaign_profit || 0) +       // Taxa de campanhas
            parseFloat(userData.academy_profit || 0) +              // Taxa da academy
            parseFloat(userData.platform_services_profit || 0);     // Upgrades/badges

        // ========================================
        // LIMITE MÁXIMO = LUCRO ACUMULADO + VALOR DAS COTAS
        // Assim o sistema NUNCA perde dinheiro com calote!
        // ========================================
        const maxLoanAmount = Math.floor(accumulatedProfit + quotasValue);

        const details = { score, quotasCount, quotasValue, marketplaceTransactions, accountAgeDays, hasOverdue, totalSpent, accumulatedProfit, maxLoanAmount };

        // Verificações de elegibilidade
        if (hasOverdue) {
            return { eligible: false, reason: 'Você possui empréstimos em atraso.', details };
        }
        if (score < MIN_SCORE_FOR_LOAN) {
            return { eligible: false, reason: `Score mínimo de ${MIN_SCORE_FOR_LOAN} necessário. Seu: ${score}`, details };
        }
        if (quotasCount < 1) {
            return { eligible: false, reason: 'Você precisa ter pelo menos 1 cota ativa.', details };
        }
        if (marketplaceTransactions < MIN_MARKETPLACE_TRANSACTIONS) {
            return { eligible: false, reason: `Mínimo ${MIN_MARKETPLACE_TRANSACTIONS} transações no Marketplace.`, details };
        }
        if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
            return { eligible: false, reason: `Conta precisa ter ${MIN_ACCOUNT_AGE_DAYS}+ dias.`, details };
        }
        if (accumulatedProfit <= 0 && quotasValue <= 0) {
            return { eligible: false, reason: 'Você precisa gerar lucro para a plataforma antes de solicitar empréstimo.', details };
        }
        if (maxLoanAmount < 10) {
            return { eligible: false, reason: `Limite muito baixo (R$ ${maxLoanAmount.toFixed(2)}). Continue gerando lucro para a plataforma.`, details };
        }

        return { eligible: true, details };
    } catch (error) {
        console.error('Erro ao verificar elegibilidade:', error);
        return { eligible: false, reason: 'Erro ao verificar', details: { score: 0, quotasCount: 0, quotasValue: 0, marketplaceTransactions: 0, accountAgeDays: 0, hasOverdue: false, totalSpent: 0, accumulatedProfit: 0, maxLoanAmount: 0 } };
    }
};

/**
 * Calcula o empréstimo com base na garantia escolhida
 */
export const calculateLoanOffer = async (
    pool: Pool | PoolClient,
    userId: string,
    requestedAmount: number,
    guaranteePercentage: number // 50, 60, 70, 80, 90 ou 100
): Promise<{
    approved: boolean;
    reason?: string;
    offer?: {
        amount: number;
        guaranteePercentage: number;
        guaranteeValue: number; // Valor em R$ das cotas bloqueadas
        interestRate: number;   // Taxa de juros (ex: 0.35 = 35%)
        totalRepayment: number; // Valor total a pagar
        availableInterestRates: { percentage: number; rate: number }[];
    }
}> => {
    try {
        // Validar % de garantia
        if (!VALID_GUARANTEE_PERCENTAGES.includes(guaranteePercentage)) {
            return { approved: false, reason: 'Percentual de garantia inválido. Use: 50, 60, 70, 80, 90 ou 100%' };
        }

        // Verificar elegibilidade
        const eligibility = await checkLoanEligibility(pool, userId);
        if (!eligibility.eligible) {
            return { approved: false, reason: eligibility.reason };
        }

        const { quotasValue, maxLoanAmount, accumulatedProfit } = eligibility.details;

        // Verificar se o valor solicitado está dentro do limite
        if (requestedAmount > maxLoanAmount) {
            return { approved: false, reason: `Valor máximo disponível: R$ ${maxLoanAmount.toFixed(2)} (lucro gerado R$ ${accumulatedProfit.toFixed(2)} + cotas R$ ${quotasValue.toFixed(2)})` };
        }

        // Calcular garantia em R$
        const guaranteeValue = quotasValue * (guaranteePercentage / 100);

        // Verificar se a garantia é suficiente
        // A garantia mínima deve cobrir pelo menos 50% do valor emprestado
        const minGuaranteeRequired = requestedAmount * 0.50;
        if (guaranteeValue < minGuaranteeRequired) {
            return { approved: false, reason: `Garantia insuficiente. Suas cotas (${guaranteePercentage}%) = R$ ${guaranteeValue.toFixed(2)}. Mínimo necessário: R$ ${minGuaranteeRequired.toFixed(2)}` };
        }

        // Verificar liquidez do sistema
        const systemRes = await pool.query(`
            SELECT 
                (SELECT COALESCE(system_balance, 0) FROM system_config LIMIT 1) as system_balance,
                (SELECT COALESCE(SUM(amount), 0) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_loaned
        `);
        const systemBalance = parseFloat(systemRes.rows[0].system_balance) || 0;
        const totalLoaned = parseFloat(systemRes.rows[0].total_loaned) || 0;
        const disponivel = Math.max(0, (systemBalance * (1 - SYSTEM_LIQUIDITY_RESERVE)) - totalLoaned);

        if (requestedAmount > disponivel) {
            return { approved: false, reason: 'Liquidez do sistema insuficiente no momento.' };
        }

        // Calcular taxa de juros baseada na garantia
        const interestRate = calculateInterestRate(guaranteePercentage);
        const totalRepayment = requestedAmount * (1 + interestRate);

        // Montar lista de taxas disponíveis
        const availableInterestRates = VALID_GUARANTEE_PERCENTAGES.map(pct => ({
            percentage: pct,
            rate: INTEREST_RATES[pct] * 100 // converter para %
        }));

        console.log('DEBUG - Oferta de Empréstimo:', {
            userId, requestedAmount, guaranteePercentage, guaranteeValue,
            interestRate, totalRepayment, maxLoanAmount
        });

        return {
            approved: true,
            offer: {
                amount: requestedAmount,
                guaranteePercentage,
                guaranteeValue,
                interestRate,
                totalRepayment: Math.ceil(totalRepayment * 100) / 100,
                availableInterestRates
            }
        };
    } catch (error) {
        console.error('Erro ao calcular oferta:', error);
        return { approved: false, reason: 'Erro ao processar' };
    }
};

/**
 * Retorna informações para o frontend
 */
export const getCreditAnalysis = async (pool: Pool | PoolClient, userId: string) => {
    const eligibility = await checkLoanEligibility(pool, userId);

    return {
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        limit: eligibility.details.maxLoanAmount,
        accumulatedProfit: eligibility.details.accumulatedProfit,
        quotasValue: eligibility.details.quotasValue,
        details: {
            ...eligibility.details,
            minScore: MIN_SCORE_FOR_LOAN,
            minMarketplaceTransactions: MIN_MARKETPLACE_TRANSACTIONS,
            minAccountAgeDays: MIN_ACCOUNT_AGE_DAYS,
            interestRates: VALID_GUARANTEE_PERCENTAGES.map(pct => ({
                guaranteePercentage: pct,
                interestRate: INTEREST_RATES[pct] * 100 // em %
            }))
        }
    };
};

// Manter compatibilidade com código existente
export const calculateUserLoanLimit = async (pool: Pool | PoolClient, userId: string): Promise<number> => {
    const eligibility = await checkLoanEligibility(pool, userId);
    return eligibility.details.maxLoanAmount;
};
