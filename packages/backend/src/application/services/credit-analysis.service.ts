
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
const LIMIT_PERCENTAGE_OF_SPENT = 0.70; // 70% do que "sumiu" (gastou/taxas)
const LIMIT_PERCENTAGE_OF_QUOTAS = 0.70; // 70% do capital social (cotas) - Margem de Segurança (LTV)

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
                u.membership_type,
                u.role,
                u.created_at,
                (SELECT COUNT(*) FROM quotas WHERE user_id = $1 AND (status = 'ACTIVE' OR status IS NULL)) as quotas_count,
                (SELECT COALESCE(SUM(current_value), 0) FROM quotas WHERE user_id = $1 AND (status = 'ACTIVE' OR status IS NULL)) as total_quotas_value,
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
                (SELECT COUNT(*) FROM transactions WHERE user_id = $1 AND type = 'BUY_QUOTA' AND status = 'PENDING') as pending_quotas
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

        // BUSCA DE LUCRO REAL DO SISTEMA PARA BÔNUS DE LIMITE
        const systemProfitRes = await pool.query(`
            SELECT 
                COALESCE(profit_pool, 0) as profit_pool,
                (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE' OR status IS NULL) as system_total_quotas
            FROM system_config LIMIT 1
        `);
        const systemProfitPool = parseFloat(systemProfitRes.rows[0]?.profit_pool || 0);
        const systemTotalQuotas = parseInt(systemProfitRes.rows[0]?.system_total_quotas || 1);

        // VERIFICAÇÃO DE HISTÓRICO DE ATRASOS (Para bônus de lucro - Elite)
        const lateHistoryRes = await pool.query(`
            SELECT COUNT(*) as late_count 
            FROM transactions 
            WHERE user_id = $1 
            AND type = 'LOAN_REPAYMENT' 
            AND (metadata->>'penaltyPaid')::numeric > 0
        `, [userId]);
        const hasLateHistory = parseInt(lateHistoryRes.rows[0].late_count) > 0;

        // REGRA DE OURO DO JOSIAS (ELITE): 
        // Bônus de 5% no limite APENAS se:
        // 1. Score >= 950
        // 2. Conta com > 90 dias
        // 3. NENHUM histórico de atraso
        // 4. Lucro Real > 0
        const isElite = score >= 950 && accountAgeDays >= 90 && !hasLateHistory;
        const profitBonusFactor = (systemProfitPool > 0 && isElite) ? 0.05 : 0;

        // --- BYPASS PARA ADMIN ---
        if (userData.role === 'ADMIN') {
            const adminDetails = {
                score: 1000,
                quotasCount: quotasCount || 100,
                quotasValue: quotasValue || 5000,
                marketplaceTransactions: 999,
                accountAgeDays: 999,
                hasOverdue: false,
                totalSpent: totalSpent || 10000,
                maxLoanAmount: 1000000, // 1 Milhão de limite
                isCurrentlyGuarantor: false
            };

            console.log(`[DEBUG_CREDIT] 👑 ADMIN DETECTED (${userId}): Bypassing limits.`);
            return { eligible: true, details: adminDetails };
        }

        // INFLUÊNCIA DO SCORE (Novo Pedido):
        // Score 0 a 1000.
        // Fator: (Score / 1000) * 0.10. Ou seja, Score 1000 dá +10% de limite. Score 500 dá +5%.
        const scoreBonus = (score / 1000) * 0.10;

        // BÔNUS DE ASSINATURA PRO (Novo Pedido):
        // Membros PRO ganham +5% de limite garantido pelo pagamento recorrente
        const isPro = userData.membership_type === 'PRO';
        const proBonus = isPro ? 0.05 : 0;

        // Limite = (70% + bônus lucro + bônus score + bônus PRO) do gasto + (70% + bônus lucro + bônus score + bônus PRO) do valor das cotas
        // O Score potencializa tanto o mérito quanto a confiança na garantia
        const totalBonus = profitBonusFactor + scoreBonus + proBonus;

        const spentLimit = totalSpent * (LIMIT_PERCENTAGE_OF_SPENT + totalBonus);
        const quotasLimit = quotasValue * (LIMIT_PERCENTAGE_OF_QUOTAS + totalBonus);

        // CORREÇÃO DE RISCO: Não somamos mais o userProfitShare direto.
        // O lucro do sistema serve apenas para ativar o 'profitBonusFactor'.
        const maxLoanAmount = Math.floor(spentLimit + quotasLimit);

        // NOVA VERIFICAÇÃO: O usuário já é fiador de alguém?
        const isGuarantorResult = await pool.query(`
            SELECT COUNT(*) FROM loans 
            WHERE status IN ('APPROVED', 'PAYMENT_PENDING') 
            AND (metadata->>'guarantorId' = $1 OR metadata->>'guarantor_id' = $1)
        `, [userId]);
        const isCurrentlyGuarantor = parseInt(isGuarantorResult.rows[0].count) > 0;

        const details = { score, quotasCount, quotasValue, marketplaceTransactions, accountAgeDays, hasOverdue, totalSpent, maxLoanAmount, isCurrentlyGuarantor };

        console.log(`[DEBUG_CREDIT] User ${userId}: Score=${score}, Quotas=${quotasCount} (R$ ${quotasValue}), Spent=R$ ${totalSpent}, Limit=R$ ${maxLoanAmount}, Eligible=${!hasOverdue}`);
        if (hasOverdue) {
            return { eligible: false, reason: 'Você possui empréstimos em atraso.', details };
        }
        if (isCurrentlyGuarantor) {
            return { eligible: false, reason: 'Você não pode solicitar apoio enquanto for fiador ativo de outro membro.', details };
        }
        if (score < MIN_SCORE_FOR_LOAN) {
            return { eligible: false, reason: `Score mínimo de ${MIN_SCORE_FOR_LOAN} necessário. Seu: ${score}`, details };
        }

        // Se NÃO tem fiador, exige pelo menos 1 cota.
        // Se TEM fiador, a verificação de quotasCount deve ser tratada no calculateLoanOffer.
        // Por padrão no checkLoanEligibility (que alimenta a UI de limite), mantemos o aviso se for 0.

        if (quotasCount < 1) {
            const pendingQuotas = parseInt(userData.pending_quotas || 0);
            if (pendingQuotas > 0) {
                return { eligible: false, reason: 'Sua participação está aguardando aprovação bancária. O limite será liberado assim que confirmarmos seu PIX.', details };
            }
            // Retornamos true mas com aviso no reason se o limite for 0, ou deixamos o controller tratar.
            // Para manter a UI funcional, se o limite for 0 mas o usuário quiser usar fiador, o calculateLoanOffer cuidará disso.
            return { eligible: true, reason: 'Você não possui participações. Para solicitar apoio, você precisará de um Fiador.', details };
        }

        if (marketplaceTransactions < MIN_MARKETPLACE_TRANSACTIONS) {
            return { eligible: false, reason: `Você precisa de pelo menos ${MIN_MARKETPLACE_TRANSACTIONS} transações concluídas no Marketplace.`, details };
        }
        if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
            return { eligible: false, reason: `Seu perfil está em análise de segurança. Disponível em ${MIN_ACCOUNT_AGE_DAYS - accountAgeDays} dias.`, details };
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
    requiresGuarantorApproval?: boolean;
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

        // Se NÃO tem fiador, o valor solicitado deve respeitar o limite individual.
        // Se TEM fiador, o limite é expandido pelas cotas do fiador.
        if (!guarantorId && requestedAmount > maxLoanAmount) {
            return { approved: false, reason: `Valor máximo disponível: R$ ${maxLoanAmount.toFixed(2)} (Baseado no seu gasto anterior e capital acumulado)` };
        }

        // Calcular garantia Pessoal
        let totalGuaranteeValue = userQuotasValue;
        let guarantorName = '';

        // Se tiver fiador, somar garantia dele
        if (guarantorId) {
            // Regra 2.0: Se tiver fiador, a garantia é AUTOMATICAMENTE 100% (mais seguro para o clube)
            guaranteePercentage = 100;

            const guarantorRes = await pool.query(`
                SELECT u.id, u.name,
                COALESCE((SELECT SUM(current_value) FROM quotas WHERE user_id = u.id AND (status = 'ACTIVE' OR status IS NULL)), 0) as total_quotas,
                (SELECT COUNT(*) FROM loans WHERE user_id = u.id AND status IN ('APPROVED', 'PAYMENT_PENDING')) as active_loans_count,
                (SELECT COUNT(*) FROM loans WHERE (metadata->>'guarantorId' = u.id OR metadata->>'guarantor_id' = u.id) AND status IN ('APPROVED', 'PAYMENT_PENDING')) as active_guarantorships
                FROM users u WHERE u.id = $1 OR u.email = $1 -- Permitir buscar por ID ou Email
            `, [guarantorId]);

            if (guarantorRes.rows.length === 0) {
                return { approved: false, reason: 'Fiador não encontrado. Verifique o ID ou Email informado.' };
            }

            const guarantorData = guarantorRes.rows[0];
            const guarantorQuotas = parseFloat(guarantorData.total_quotas);

            // TRAVA: Fiador não pode ter empréstimos ativos próprios
            if (parseInt(guarantorData.active_loans_count) > 0) {
                return { approved: false, reason: 'Este fiador não pode ser usado pois possui empréstimos ativos próprios.' };
            }

            // TRAVA: Fiador não pode já ser fiador de outra pessoa (um por vez)
            if (parseInt(guarantorData.active_guarantorships) > 0) {
                return { approved: false, reason: 'Este fiador já está apadrinhando outro membro no momento.' };
            }

            totalGuaranteeValue += guarantorQuotas;
            guarantorName = guarantorData.name;
        }

        // A garantia necessária é baseada na porcentagem escolhida do valor do empréstimo
        const requiredGuaranteeValue = requestedAmount * (guaranteePercentage / 100);

        if (totalGuaranteeValue < requiredGuaranteeValue) {
            return {
                approved: false,
                reason: `Garantia insuficiente. Suas cotas ${guarantorId ? '+ Fiador ' : ''}somam R$ ${totalGuaranteeValue.toFixed(2)}. Para apoio de R$ ${requestedAmount.toFixed(2)} com ${guaranteePercentage}% de garantia, você precisa de R$ ${requiredGuaranteeValue.toFixed(2)} em capital social.`
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
            requiresGuarantorApproval: !!guarantorId,
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
