// Estrutura de preço da cota (Total R$ 50,00)
export const QUOTA_PRICE = 50.00; // Preço de aquisição total (R$ 50)
export const QUOTA_SHARE_VALUE = 50.00; // Valor CHEIO vai para o Capital Social (Spread gera o lucro)
export const QUOTA_ADM_FEE = 0.00;   // Taxa de Manutenção removida (Lucro via Spread)

// Distribuição da Taxa Administrativa (Soma = 100%) - Aplicado em Cotas e Taxas Fixas
export const QUOTA_FEE_TAX_SHARE = 0.20;         // 20% = R$ 1,60 → Impostos
export const QUOTA_FEE_OPERATIONAL_SHARE = 0.20; // 20% = R$ 1,60 → Servidores/APIs
export const QUOTA_FEE_OWNER_SHARE = 0.20;       // 20% = R$ 1,60 → Pró-labore
export const QUOTA_FEE_INVESTMENT_SHARE = 0.20;  // 20% = R$ 1,60 → Fundo de Estabilidade
export const QUOTA_FEE_CORPORATE_SHARE = 0.20;   // 20% = R$ 1,60 → Investimento em Empresas/Equity

// Constantes globais para distribuição de taxas da plataforma (Regra 25/25/25/25)
// Usado em: Apoio Mútuo, Marketplace, Upgrades, Boosts, etc.
export const PLATFORM_FEE_TAX_SHARE = 0.20;         // 20% do faturamento da empresa (1.2% do total)
export const PLATFORM_FEE_OPERATIONAL_SHARE = 0.20; // 20%
export const PLATFORM_FEE_OWNER_SHARE = 0.20;       // 20%
export const PLATFORM_FEE_INVESTMENT_SHARE = 0.20;  // 20% (Fundo de Estabilidade)
export const PLATFORM_FEE_CORPORATE_SHARE = 0.20;   // 20% (Investimento em Empresas/Equity)

// Taxa de sustentabilidade do apoio mútuo (20%)
export const LOAN_INTEREST_RATE = Number(process.env.LOAN_INTEREST_RATE) || 0.2;

// Taxa de Proteção de Crédito (FGC) - 2.0% sobre o valor do empréstimo
// Esta taxa é paga pelo tomador e integralizada no Fundo de Garantia de Crédito
export const LOAN_GFC_FEE_RATE = 0.02;

// Taxa de multa por resgate antecipado (40%)
export const PENALTY_RATE = Number(process.env.PENALTY_RATE) || 0.4;

// Período de carência em milissegundos (1 ano)
export const VESTING_PERIOD_MS = (Number(process.env.VESTING_PERIOD_DAYS) || 365) * 24 * 60 * 60 * 1000;

// Taxa diária de atraso (0.066% ao dia = 2% ao mês - limite legal)
export const DAILY_LATE_FEE = 0.00066;
export const MAX_LATE_PENALTY = 0.02; // Limite máximo de 2%

// Um mês em milissegundos (para simulação de tempo)
export const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Chave PIX do administrador (para pagamentos manuais)
export const ADMIN_PIX_KEY = process.env.ADMIN_PIX_KEY || 'pix@cred30.com.br';

// Porcentagens para distribuição de excedentes operacionais
export const DIVIDEND_USER_SHARE = 0.85; // 85% para os usuários
export const DIVIDEND_MAINTENANCE_SHARE = 0.15; // 15% para manutenção total

// Detalhamento do DIVIDEND_MAINTENANCE_SHARE (A soma deve ser 0.15)
export const MAINTENANCE_TAX_SHARE = 0.03;      // 3% para Impostos (Simples Nacional/MEI)
export const MAINTENANCE_OPERATIONAL_SHARE = 0.03; // 3% para Servidores/APIs
export const MAINTENANCE_OWNER_SHARE = 0.03;    // 3% para Seu Pró-labore (Salário)
export const MAINTENANCE_INVESTMENT_SHARE = 0.03; // 3% para Expansão/Investment Reserve
export const MAINTENANCE_CORPORATE_SHARE = 0.03; // 3% para Pote de Empresas (Venture Capital)

// --- Taxas de Monetização (Caixa da Cooperativa) ---
export const QUOTA_PURCHASE_FEE_RATE = 0.0; // Desativado (Substituído pela taxa fixa QUOTA_ADM_FEE)
export const LOAN_ORIGINATION_FEE_RATE = 0.00; // Removido por solicitação do Josias (Valor integral no apoio)
export const WITHDRAWAL_FIXED_FEE = 3.50; // Taxa fixa de R$ 3,50 por saque (se não tiver cotas suficientes)
export const MIN_WITHDRAWAL_AMOUNT = 1.00; // Valor mínimo para saque = R$ 1,00
export const MARKETPLACE_ESCROW_FEE_RATE = 0.12; // 12% de taxa para vendedores verificados (Com Selo)
export const MARKETPLACE_NON_VERIFIED_FEE_RATE = 0.275; // 27.5% de taxa para vendedores sem selo

// === LIMITES DE VENDAS MENSAIS (COMPLIANCE FISCAL) ===
// CPF: Limite de R$ 2.000/mês (evitar caracterização de atividade comercial habitual)
// MEI: R$ 81.000/ano = R$ 6.750/mês (limite legal do MEI)
// ME/LTDA: Sem limite (empresa regularizada com contador)
export const SELLER_MONTHLY_LIMIT_CPF = 2000.00; // Limite mensal para QUALQUER CPF (com ou sem selo)
export const SELLER_MONTHLY_LIMIT_MEI = 6750.00; // Limite mensal para MEI (R$ 81.000/ano ÷ 12)
export const SELLER_MONTHLY_LIMIT_CNPJ = 0; // 0 = Sem limite (ME, LTDA, SA, etc)
export const SELLER_MONTHLY_LIMIT_NON_VERIFIED = 2000.00; // Legado (manter compatibilidade)

// Taxas para Entregadores (Logística)
export const COURIER_VERIFIED_FEE_RATE = 0.10; // 10% para entregadores com selo
export const COURIER_NON_VERIFIED_FEE_RATE = 0.275; // 27.5% para entregadores sem selo
export const LOGISTICS_SUSTAINABILITY_FEE_RATE = 0.10; // Base rate for calculations
export const MARKET_BOOST_PRICE = 5.00; // Taxa de impulsionamento de anúncio (7 dias)
export const MARKET_CREDIT_INTEREST_RATE = 0.015; // 1.5% ao mês (Mais barato que o apoio mútuo padrão)
export const MARKET_CREDIT_MAX_INSTALLMENTS = 24; // Até 24x para facilitar compras grandes
export const MARKET_CREDIT_MIN_SCORE = 450; // Score mínimo para comprar parcelado
export const MARKET_CREDIT_MIN_QUOTAS = 1; // Mínimo de 1 cota ativa (Skin in the Game) para parcelar
// export const LOGISTICS_SUSTAINABILITY_FEE_RATE = 0.10; // Removido para evitar conflito
export const DELIVERY_MIN_FEES: Record<string, number> = {
    'BIKE': 5.00,
    'MOTO': 10.00,
    'CAR': 30.00,
    'TRUCK': 80.00
};
export const DEFAULT_VEHICLE = 'MOTO';

// --- Taxas de Movimentação de Vídeos (Watch to Earn) ---
export const VIDEO_VIEWER_SHARE = 0.10;       // 10% para quem assiste (Garante R$ 0,01 por vídeo de R$ 0,10)
export const VIDEO_QUOTA_HOLDERS_SHARE = 0.25; // 25% para quem tem cotas (profit_pool)
export const VIDEO_SERVICE_FEE_SHARE = 0.65;  // 65% taxa de serviço (system_balance - para pagar as recompensas)

// --- SISTEMA DE BENEFÍCIO DE BOAS-VINDAS (INDICAÇÃO) ---
// Ao invés de pagar R$ 5,00 de bônus, o indicado ganha desconto nas taxas
export const REFERRAL_BONUS = 0; // Desativado - substituído pelo sistema de benefício

// Benefício de Boas-Vindas para indicados (3 usos com desconto)
export const WELCOME_BENEFIT_MAX_USES = 3; // Quantidade de usos com desconto

// Taxa de apoio especial para indicados (ao invés de 20%)
export const WELCOME_LOAN_INTEREST_RATE = 0.035; // 3.5% para indicados

// Desconto nas outras taxas para indicados (50% off)
export const WELCOME_FEE_DISCOUNT = 0.5; // 50% de desconto

// Taxa de originação com desconto para indicados
export const WELCOME_LOAN_ORIGINATION_FEE_RATE = LOAN_ORIGINATION_FEE_RATE * (1 - WELCOME_FEE_DISCOUNT); // 1.5%

// Taxa de saque com desconto para indicados  
export const WELCOME_WITHDRAWAL_FIXED_FEE = WITHDRAWAL_FIXED_FEE * (1 - WELCOME_FEE_DISCOUNT); // R$ 1,00

// Taxa de escrow do marketplace com desconto para indicados
export const WELCOME_MARKETPLACE_ESCROW_FEE_RATE = MARKETPLACE_ESCROW_FEE_RATE * (1 - WELCOME_FEE_DISCOUNT); // 2.5%

// --- Novas Fontes de Receita (Alta Margem) ---
export const VERIFIED_BADGE_PRICE = 9.90; // Taxa única para selo de confiança
export const PRIORITY_WITHDRAWAL_FEE = 5.00; // Taxa para saque expresso
export const SCORE_BOOST_PRICE = 15.00; // Preço do pacote de +100 Score
export const SCORE_BOOST_POINTS = 100; // Pontos ganhos no pacote
export const REPUTATION_CHECK_PRICE = 35.00; // Preço da consulta de reputação (Serasa Standard)
export const MUTUAL_PROTECTION_PRICE = 5.00; // Preço mensal da Proteção Mútua (Social Protection)

// Sistema atual: PIX Manual
// Não há taxas de gateway externo
// Todos os pagamentos são feitos via transferência PIX direta para ADMIN_PIX_KEY

// Níveis VIP
export const VIP_LEVELS = {
    BRONZE: { name: 'Bronze', minQuotas: 0, multiplier: 1.2 },
    PRATA: { name: 'Prata', minQuotas: 10, multiplier: 1.5 },
    OURO: { name: 'Ouro', minQuotas: 50, multiplier: 2.0 },
    FOUNDER: { name: 'Fundador', minQuotas: 100, multiplier: 3.0 }
};

// Define o limite máximo de sócios ativos antes de ativar a WAITLIST automática.
// Manter baixo para caracterizar "Private Placement" (Grupo Fechado).
export const MAX_ACTIVE_MEMBERS = 100;
export const WAITLIST_ENABLED = true;

// --- PROTEÇÃO ANTI-BALEIA (ANTI-WHALE) ---
// Limite máximo de cotas que um único CPF pode deter.
// R$ 50.000,00 (1000 cotas) para evitar domínio econômico e PLD (Prevenção Lavagem Dinheiro).
export const MAX_QUOTAS_PER_USER = 1000;

// --- SISTEMA DE SEGURO DE ENTREGAS ---
// Taxa total do seguro (5% do ganho do entregador + 5% da taxa de sustentabilidade)
export const DELIVERY_INSURANCE_RATE = 0.05; // 5% de cada parte
export const DELIVERY_INSURANCE_COURIER_SHARE = 0.50; // 50% vem do entregador
export const DELIVERY_INSURANCE_PLATFORM_SHARE = 0.50; // 50% vem da Cred30

// Tipos de Incidentes de Entrega
export const DELIVERY_CLAIM_TYPES = {
    LOST: 'LOST',           // Produto perdido
    DAMAGED: 'DAMAGED',     // Produto danificado
    ACCIDENT: 'ACCIDENT',   // Acidente com entregador
    THEFT: 'THEFT',         // Roubo/Assalto
    OTHER: 'OTHER'          // Outro
};

// ===================================================================
// SISTEMA PDV (Ponto de Venda) - ASSINATURAS PARA COMERCIANTES
// ===================================================================

// Planos de Assinatura PDV
export const PDV_PLANS = {
    BASIC: {
        code: 'PDV_BASIC',
        price: 29.90,
        maxDevices: 1,
        name: 'Básico',
        description: 'PDV + Relatórios básicos'
    },
    PRO: {
        code: 'PDV_PRO',
        price: 59.90,
        maxDevices: 3,
        name: 'Profissional',
        description: 'Sincronização + Suporte prioritário'
    },
    ENTERPRISE: {
        code: 'PDV_ENTERPRISE',
        price: 99.90,
        maxDevices: 999,
        name: 'Enterprise',
        description: 'Multi-loja + API + Suporte dedicado'
    }
};

// Distribuição da Receita de Assinatura PDV (Total = 100%)
export const PDV_FEE_TAX_SHARE = 0.20;         // 20% Impostos
export const PDV_FEE_OPERATIONAL_SHARE = 0.20; // 20% Operacional (servidores, etc)
export const PDV_FEE_OWNER_SHARE = 0.20;       // 20% Pró-labore
export const PDV_FEE_STABILITY_SHARE = 0.15;   // 15% Fundo de Estabilidade
export const PDV_FEE_COTISTA_SHARE = 0.05;     // 5% Para cotistas (profit_pool)
export const PDV_FEE_CORPORATE_SHARE = 0.20;   // 20% Venture Capital/Empresas
