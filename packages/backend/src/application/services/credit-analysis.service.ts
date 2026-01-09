
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
// Constantes de Meritocracia Flexível
const MIN_SCORE_FOR_LOAN = 0; // Removido bloqueio por score - garantia real via cotas é suficiente
const MIN_MARKETPLACE_TRANSACTIONS = 0; // Se tem cota, já é parceiro
const MIN_ACCOUNT_AGE_DAYS = 0;  // Liberação imediata para detentores de cotas
const SYSTEM_LIQUIDITY_RESERVE = 0.30;
const LIMIT_PERCENTAGE_OF_SPENT = 0.80; // 80% do que "sumiu" (gastou/taxas)
const LIMIT_PERCENTAGE_OF_QUOTAS = 0.50; // 50% do capital social (cotas)

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
        maxLoanAmount: number;
    }
}> => {
    try {
        // Dados do usuário e gastos
        const userDataRes = await pool.query(`
            SELECT 
                u.score, 
                u.created_at,
                (SELECT COUNT(*) FROM quotas WHERE user_id = $1 AND status = 'ACTIVE') as quotas_count,
                (SELECT COALESCE(SUM(current_value), 0) FROM quotas WHERE user_id = $1 AND status = 'ACTIVE') as total_quotas_value,
                (SELECT COUNT(*) FROM marketplace_orders WHERE buyer_id = $1 AND status = 'COMPLETED') as purchases,
                (SELECT COUNT(*) FROM marketplace_orders mo JOIN marketplace_listings ml ON mo.listing_id = ml.id WHERE ml.seller_id = $1 AND mo.status = 'COMPLETED') as sales,
                (SELECT COUNT(*) FROM loans WHERE user_id = $1 AND status = 'APPROVED' AND due_date < NOW()) as overdue_loans,
                -- Total gasto (sem cotas)
                COALESCE((SELECT SUM(amount) FROM marketplace_orders WHERE buyer_id = $1 AND status = 'COMPLETED'), 0) as marketplace_spent,
                COALESCE((SELECT SUM(budget_gross) FROM promo_videos WHERE user_id = $1), 0) as campaign_spent,
                COALESCE((SELECT SUM(ABS(amount)) FROM transactions 
                    WHERE user_id = $1 AND status = 'APPROVED' 
                    AND type IN ('MEMBERSHIP_UPGRADE', 'BUY_VERIFIED_BADGE', 'BUY_SCORE_PACKAGE', 'MARKET_BOOST')
                ), 0) as platform_spent,
                (SELECT COUNT(*) FROM transactions WHERE user_id = $1 AND type = 'QUOTA_PURCHASE' AND status = 'PENDING') as pending_quotas
            FROM users u
            WHERE u.id = $1
        `, [userId]);

        if (userDataRes.rows.length === 0) {
            return { eligible: false, reason: 'Usuário não encontrado', details: { score: 0, quotasCount: 0, quotasValue: 0, marketplaceTransactions: 0, accountAgeDays: 0, hasOverdue: false, totalSpent: 0, maxLoanAmount: 0 } };
        }

        const userData = userDataRes.rows[0];
        const score = parseInt(userData.score) || 0;
        const quotasCount = parseInt(userData.quotas_count) || 0;
        const quotasValue = parseFloat(userData.total_quotas_value) || 0;
        const marketplaceTransactions = parseInt(userData.purchases || 0) + parseInt(userData.sales || 0);
        const accountAgeDays = Math.floor((Date.now() - new Date(userData.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const hasOverdue = parseInt(userData.overdue_loans) > 0;

        // Total gasto (sem cotas resgatáveis) + Taxa Adm das Cotas (que é gasto)
        const totalSpent = parseFloat(userData.marketplace_spent || 0) +
            parseFloat(userData.campaign_spent || 0) +
            parseFloat(userData.platform_spent || 0) +
            (quotasCount * 8.0); // 8,00 por cota é taxa de manutenção (gasto)

        // Limite = 80% do gasto + 50% do valor das cotas
        const maxLoanAmount = Math.floor((totalSpent * LIMIT_PERCENTAGE_OF_SPENT) + (quotasValue * LIMIT_PERCENTAGE_OF_QUOTAS));

        const details = { score, quotasCount, quotasValue, marketplaceTransactions, accountAgeDays, hasOverdue, totalSpent, maxLoanAmount };

        // Verificações
        if (hasOverdue) {
            return { eligible: false, reason: 'Você possui empréstimos em atraso.', details };
        }
        if (score < MIN_SCORE_FOR_LOAN) {
            return { eligible: false, reason: `Score mínimo de ${MIN_SCORE_FOR_LOAN} necessário. Seu: ${score}`, details };
        }
        if (quotasCount < 1) {
            const pendingQuotas = parseInt(userData.pending_quotas || 0);
            if (pendingQuotas > 0) {
                return { eligible: false, reason: 'Sua participação está aguardando aprovação bancária. O limite será liberado assim que confirmarmos seu PIX.', details };
            }
            return { eligible: false, reason: 'Você precisa ter pelo menos 1 participação ativa no Clube para liberar o Apoio Mútuo.', details };
        }
        if (marketplaceTransactions < MIN_MARKETPLACE_TRANSACTIONS) {
            return { eligible: false, reason: `Você precisa de pelo menos ${MIN_MARKETPLACE_TRANSACTIONS} transações concluídas no Marketplace.`, details };
        }
        if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
            return { eligible: false, reason: `Seu perfil está em análise de segurança. Disponível em ${MIN_ACCOUNT_AGE_DAYS - accountAgeDays} dias.`, details };
        }
        if (totalSpent <= 0 && quotasCount <= 0) {
            return { eligible: false, reason: 'É necessário ter movimentação na plataforma ou capital social (cotas) para gerar limite.', details };
        }

        return { eligible: true, details };
    } catch (error: any) {
        console.error('Erro ao verificar elegibilidade:', error);
        return { eligible: false, reason: `Erro técnico na análise: ${error.message}`, details: { score: 0, quotasCount: 0, quotasValue: 0, marketplaceTransactions: 0, accountAgeDays: 0, hasOverdue: false, totalSpent: 0, maxLoanAmount: 0 } };
    }
};

/**
 * Calcula o empréstimo com base na garantia escolhida
 */
export const calculateLoanOffer = async (
    pool: Pool | PoolClient,
    userId: string,
    requestedAmount: number,
    guaranteePercentage: number, // 50, 60, 70, 80, 90 ou 100
    guarantorId?: string // Opcional: ID do Fiador
): Promise<{
    approved: boolean;
    reason?: string;
    offer?: {
        amount: number;
        guaranteePercentage: number;
        guaranteeValue: number; // Valor em R$ das cotas bloqueadas (Pessoal + Fiador)
        guarantorName?: string;
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

        // Se houver fiador, não pode ser o mesmo usuário
        if (guarantorId && guarantorId === userId) {
            return { approved: false, reason: 'Você não pode ser seu próprio fiador.' };
        }

        // Verificar elegibilidade do Tomador
        const eligibility = await checkLoanEligibility(pool, userId);
        if (!eligibility.eligible) {
            return { approved: false, reason: eligibility.reason };
        }

        const { quotasValue: userQuotasValue, maxLoanAmount } = eligibility.details;

        // Verificar se o valor solicitado está dentro do limite
        if (requestedAmount > maxLoanAmount) {
            return { approved: false, reason: `Valor máximo disponível: R$ ${maxLoanAmount.toFixed(2)} (Baseado no seu gasto anterior e capital acumulado)` };
        }

        // Calcular garantia Pessoal
        let totalGuaranteeValue = userQuotasValue;
        let guarantorName = '';

        // Se tiver fiador, somar garantia dele
        if (guarantorId) {
            const guarantorRes = await pool.query(`
                SELECT u.name,
                COALESCE((SELECT SUM(current_value) FROM quotas WHERE user_id = $1 AND status = 'ACTIVE'), 0) as total_quotas
                FROM users u WHERE u.id = $1
            `, [guarantorId]);

            if (guarantorRes.rows.length === 0) {
                return { approved: false, reason: 'Fiador não encontrado.' };
            }

            const guarantorQuotas = parseFloat(guarantorRes.rows[0].total_quotas);

            // Verificar se fiador tem bloqueios (empréstimos ativos ou outras fianças) faria parte de uma verificação mais complexa.
            // Para simplificar, assumimos que todas as cotas ativas contam, mas o bloqueio de venda entra em vigor se o empréstimo for aprovado.

            totalGuaranteeValue += guarantorQuotas;
            guarantorName = guarantorRes.rows[0].name;

            console.log(`[CREDIT_ANALYSIS] Fiador ${guarantorName} adicionou R$ ${guarantorQuotas} de garantia.`);
        }

        // A garantia necessária é baseada na porcentagem escolhida do valor do empréstimo
        // Ex: Empréstimo de 1000 com 50% de garantia precisa de 500 reais em cotas.
        const requiredGuaranteeValue = requestedAmount * (guaranteePercentage / 100);

        if (totalGuaranteeValue < requiredGuaranteeValue) {
            return {
                approved: false,
                reason: `Garantia insuficiente. Suas cotas ${guarantorId ? '+ Fiador ' : ''}somam R$ ${totalGuaranteeValue.toFixed(2)}. Para ${guaranteePercentage}% de garantia, você precisa de R$ ${requiredGuaranteeValue.toFixed(2)}.`
            };
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
            userId, requestedAmount, guaranteePercentage, totalGuaranteeValue,
            interestRate, totalRepayment, maxLoanAmount, guarantorId
        });

        return {
            approved: true,
            offer: {
                amount: requestedAmount,
                guaranteePercentage,
                guaranteeValue: requiredGuaranteeValue, // Valor Comprometido
                guarantorName,
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
