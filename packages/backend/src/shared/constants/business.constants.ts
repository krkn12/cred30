// Preço da cota
export const QUOTA_PRICE = Number(process.env.QUOTA_PRICE) || 50;

// Taxa de juros de empréstimo (20%)
export const LOAN_INTEREST_RATE = Number(process.env.LOAN_INTEREST_RATE) || 0.2;

// Taxa de multa por resgate antecipado (40%)
export const PENALTY_RATE = Number(process.env.PENALTY_RATE) || 0.4;

// Período de carência em milissegundos (1 ano)
export const VESTING_PERIOD_MS = (Number(process.env.VESTING_PERIOD_DAYS) || 365) * 24 * 60 * 60 * 1000;

// Um mês em milissegundos (para simulação de tempo)
export const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Chave PIX do administrador
export const ADMIN_PIX_KEY = process.env.ADMIN_PIX_KEY || '91980177874';

// Porcentagens para distribuição de dividendos
export const DIVIDEND_USER_SHARE = 0.85; // 85% para os usuários
export const DIVIDEND_MAINTENANCE_SHARE = 0.15; // 15% para manutenção

// Bônus por indicação
export const REFERRAL_BONUS = 5.00; // R$ 5,00