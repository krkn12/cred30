// =====================================================
// ESTRUTURA DE PREÇO DA LICENÇA (Total R$ 50,00)
// =====================================================
// O sistema ABSORVE as taxas do gateway (Asaas)
// Taxa PIX Asaas = R$ 1,99
// Por isso a taxa admin é R$ 10 (para sobrar R$ 8 líquido)
// =====================================================
export const QUOTA_PRICE = 50.00; // Preço de aquisição total
export const QUOTA_SHARE_VALUE = 40.00; // Valor que vai para o Capital Social (Resgatável)
export const QUOTA_ADM_FEE = 10.00;   // Taxa de Manutenção Administrativa (Não resgatável)
// Inclui: R$ 8 distribuição interna + ~R$ 2 para cobrir taxa Asaas

// Distribuição da Taxa Administrativa LÍQUIDA (após Asaas)
// Base de cálculo: R$ 8 (R$ 10 - R$ 2 do Asaas)
export const QUOTA_FEE_TAX_SHARE = 0.25;         // 25% = R$ 2,00 → Impostos
export const QUOTA_FEE_OPERATIONAL_SHARE = 0.25; // 25% = R$ 2,00 → Servidores/APIs
export const QUOTA_FEE_OWNER_SHARE = 0.25;       // 25% = R$ 2,00 → Pró-labore
export const QUOTA_FEE_INVESTMENT_SHARE = 0.25;  // 25% = R$ 2,00 → Fundo de Investimento

// Constantes globais para distribuição de taxas da plataforma (Regra 25/25/25/25)
// Usado em: Empréstimos, Marketplace, Upgrades, Boosts, etc.
export const PLATFORM_FEE_TAX_SHARE = 0.25;
export const PLATFORM_FEE_OPERATIONAL_SHARE = 0.25;
export const PLATFORM_FEE_OWNER_SHARE = 0.25;
export const PLATFORM_FEE_INVESTMENT_SHARE = 0.25;

// Taxa de sustentabilidade do apoio mútuo (20%)
export const LOAN_INTEREST_RATE = Number(process.env.LOAN_INTEREST_RATE) || 0.2;

// Taxa de multa por resgate antecipado (40%)
export const PENALTY_RATE = Number(process.env.PENALTY_RATE) || 0.4;

// Período de carência em milissegundos (1 ano)
export const VESTING_PERIOD_MS = (Number(process.env.VESTING_PERIOD_DAYS) || 365) * 24 * 60 * 60 * 1000;

// Taxa diária de atraso (0.5% ao dia de multa por atraso)
export const DAILY_LATE_FEE = 0.005;

// Um mês em milissegundos (para simulação de tempo)
export const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Chave PIX do administrador
// Porcentagens para distribuição de excedentes operacionais
export const DIVIDEND_USER_SHARE = 0.85; // 85% para os usuários
export const DIVIDEND_MAINTENANCE_SHARE = 0.15; // 15% para manutenção total

// Detalhamento do DIVIDEND_MAINTENANCE_SHARE (A soma deve ser 0.15)
export const MAINTENANCE_TAX_SHARE = 0.06;      // 6% para Impostos (Simples Nacional/MEI)
export const MAINTENANCE_OPERATIONAL_SHARE = 0.04; // 4% para Servidores/APIs
export const MAINTENANCE_OWNER_SHARE = 0.05;    // 5% para Seu Pró-labore (Salário)

// --- Taxas de Monetização (Caixa da Cooperativa) ---
export const QUOTA_PURCHASE_FEE_RATE = 0.0; // Desativado (Substituído pela taxa fixa QUOTA_ADM_FEE)
export const LOAN_ORIGINATION_FEE_RATE = 0.03; // 3% de taxa de originação (seguro)
export const WITHDRAWAL_FIXED_FEE = 2.00; // Taxa fixa de R$ 2,00 por saque
export const MIN_WITHDRAWAL_AMOUNT = 50.00; // Valor mínimo para saque
export const MARKETPLACE_ESCROW_FEE_RATE = 0.12; // 12% de taxa de garantia (Escrow) para verificados
export const MARKETPLACE_NON_VERIFIED_FEE_RATE = 0.275; // 27.5% de taxa para vendedores não verificados
export const MARKET_CREDIT_INTEREST_RATE = 0.015; // 1.5% ao mês (Mais barato que o apoio mútuo padrão)
export const MARKET_CREDIT_MAX_INSTALLMENTS = 24; // Até 24x para facilitar compras grandes
export const MARKET_CREDIT_MIN_SCORE = 450; // Score mínimo para comprar parcelado
export const MARKET_CREDIT_MIN_QUOTAS = 1; // Mínimo de 1 cota ativa (Skin in the Game) para parcelar
export const LOGISTICS_SUSTAINABILITY_FEE_RATE = 0.10; // 10% de taxa administrativa sobre o valor do frete para sustentabilidade do grupo

// --- Taxas de Movimentação de Vídeos (Watch to Earn) ---
export const VIDEO_VIEWER_SHARE = 0.60;       // 60% para quem assiste
export const VIDEO_QUOTA_HOLDERS_SHARE = 0.25; // 25% para quem tem cotas (profit_pool)
export const VIDEO_SERVICE_FEE_SHARE = 0.15;  // 15% taxa de serviço (system_balance)

// --- Taxas da Academia (Marketplace Estilo Udemy) ---
export const ACADEMY_TOTAL_FEE_RATE = 0.175;       // 17.5% Taxa total
export const ACADEMY_AUTHOR_SHARE = 0.825;         // 82.5% Para o professor
export const ACADEMY_PLATFORM_SHARE = 0.075;       // 7.5% Para o sistema (system_balance)
export const ACADEMY_SUPPORTERS_SHARE = 0.10;      // 10% Para cotistas (profit_pool)

// --- SISTEMA DE BENEFÍCIO DE BOAS-VINDAS (INDICAÇÃO) ---
// Ao invés de pagar R$ 5,00 de bônus, o indicado ganha desconto nas taxas
export const REFERRAL_BONUS = 0; // Desativado - substituído pelo sistema de benefício

// Benefício de Boas-Vindas para indicados (3 usos com desconto)
export const WELCOME_BENEFIT_MAX_USES = 3; // Quantidade de usos com desconto

// Taxa de empréstimo especial para indicados (ao invés de 20%)
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

// =====================================================
// CONFIGURAÇÃO DE GATEWAY (ASAAS)
// =====================================================
// true = Usa a API do Asaas (Automático)
// false = Modo Manual (Você recebe PIX no seu CPF e aprova no app)
export const USE_ASAAS = false;

// Sua chave PIX para os usuários enviarem dinheiro (Modo Manual)
export const ADMIN_PIX_KEY = "91980177874";

// Taxas oficiais do Asaas (Gateway de Pagamento) - Atualizadas em 03/01/2026
// ATENÇÃO: Nos primeiros 3 meses as taxas são promocionais (R$ 0,99)
// Após 3 meses, passam para R$ 1,99

// PIX (Recebimento) - Taxa FIXA por transação
export const ASAAS_PIX_FEE_PERCENT = 0.00; // 0% (não tem percentual)
export const ASAAS_PIX_FIXED_FEE = 1.99;   // R$ 1,99 por venda (após período promocional)
// Promocional (primeiros 3 meses): R$ 0,99

// Boleto Bancário - Taxa FIXA por boleto PAGO (emissão grátis)
export const ASAAS_BOLETO_FIXED_FEE = 1.99; // R$ 1,99 por boleto pago (após promocional)
// Promocional (primeiros 3 meses): R$ 0,99

// Cartão de Crédito - Taxa PERCENTUAL + FIXA
export const ASAAS_CARD_FEE_PERCENT = 0.0299; // 2.99% à vista
export const ASAAS_CARD_FIXED_FEE = 0.49;     // R$ 0,49 por transação

// Escalonamento parcelado no cartão
export const ASAAS_CARD_INSTALLMENTS_FEES = {
    '1': 0.0299,     // 2.99% à vista
    '2-6': 0.0349,   // 3.49% parcelado 2-6x
    '7-12': 0.0399,  // 3.99% parcelado 7-12x
    '13-21': 0.0449  // 4.49% parcelado 13-21x (estimado)
};

// Custos Operacionais de Movimentação (Saída)
// NOTA: PJ tem cota de 30 transferências gratuitas/mês
export const ASAAS_TED_FEE = 5.00; // R$ 5,00 por transferência TED
export const ASAAS_PIX_OUT_FEE = 5.00; // R$ 5,00 por Pix de saída (fora da cota gratuita)

// Notificações e Serviços Extras
export const ASAAS_WHATSAPP_FEE = 0.55; // R$ 0,55 por notificação WhatsApp
export const ASAAS_SMS_FEE = 0.99;      // R$ 0,99 por SMS
export const ASAAS_SERASA_NEG_FEE = 9.90; // R$ 9,90 por negativação

// Compatibilidade com código legado (Mercado Pago)
export const MERCADO_PAGO_PIX_FEE_PERCENT = ASAAS_PIX_FEE_PERCENT;
export const MERCADO_PAGO_FIXED_FEE = ASAAS_PIX_FIXED_FEE;
export const MERCADO_PAGO_CARD_FEE_PERCENT = ASAAS_CARD_FEE_PERCENT;
export const MERCADO_PAGO_CARD_FIXED_FEE = ASAAS_CARD_FIXED_FEE;

// Níveis VIP
export const VIP_LEVELS = {
    BRONZE: { name: 'Bronze', minQuotas: 0, multiplier: 1.2 },
    PRATA: { name: 'Prata', minQuotas: 10, multiplier: 1.5 },
    OURO: { name: 'Ouro', minQuotas: 50, multiplier: 2.0 },
    FOUNDER: { name: 'Fundador', minQuotas: 100, multiplier: 3.0 }
};
