// Constantes do sistema
export const QUOTA_PRICE = 50; // Preço da cota em reais
export const DIVIDEND_USER_SHARE = 0.85; // 85% dos lucros vão para os usuários
export const DIVIDEND_MAINTENANCE_SHARE = 0.15; // 15% dos lucros vão para manutenção
export const REFERRAL_BONUS = 5.00; // Bônus de indicação em reais

// Taxas e limites
export const WITHDRAWAL_FEE_PERCENTAGE = 0.02; // 2% de taxa de saque
export const WITHDRAWAL_FEE_FIXED = 5.00; // Taxa fixa mínima de saque
export const LOAN_INTEREST_RATE = 0.2; // 20% de juros sobre empréstimos
export const LOAN_PENALTY_RATE = 0.4; // 40% de multa por atraso

// Prazos
export const VESTING_PERIOD_DAYS = 365; // Período de vesting em dias
export const LOAN_DEFAULT_INSTALLMENTS = 12; // Parcelas padrão de empréstimo

// Limites do sistema
export const MAX_LOAN_AMOUNT = 10000; // Valor máximo de empréstimo
export const MIN_LOAN_AMOUNT = 100; // Valor mínimo de empréstimo
export const MAX_WITHDRAWAL_AMOUNT = 50000; // Valor máximo de saque
export const MIN_WITHDRAWAL_AMOUNT = 10; // Valor mínimo de saque

// Status
export const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
} as const;

export const TRANSACTION_TYPES = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  BUY_QUOTA: 'BUY_QUOTA',
  SELL_QUOTA: 'SELL_QUOTA',
  LOAN_PAYMENT: 'LOAN_PAYMENT',
  LOAN_APPROVED: 'LOAN_APPROVED',
  REFERRAL_BONUS: 'REFERRAL_BONUS',
  DIVIDEND: 'DIVIDEND'
} as const;

export const LOAN_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
  PAYMENT_PENDING: 'PAYMENT_PENDING'
} as const;

export const QUOTA_STATUS = {
  ACTIVE: 'ACTIVE',
  SOLD: 'SOLD',
  PENDING: 'PENDING'
} as const;

export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED'
} as const;