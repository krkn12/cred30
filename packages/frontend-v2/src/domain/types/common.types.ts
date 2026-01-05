export interface User {
  id: string;
  name: string;
  email: string;
  pixKey: string;
  balance: number;
  asaas_wallet_id?: string;
  joinedAt: string;
  referralCode: string;
  isAdmin?: boolean;
  score?: number;
  secretPhrase?: string;
  twoFactorEnabled?: boolean;
  role?: 'MEMBER' | 'ATTENDANT' | 'ADMIN';
  status?: 'ACTIVE' | 'BLOCKED';
  membership_type?: 'FREE' | 'PRO';
  cpf?: string | null; // CPF do usuário (obrigatório para saque)
  phone?: string | null;
  securityLockUntil?: number; // Timestamp em milissegundos
  total_dividends_earned?: number;
  last_login_at?: string;
  video_points?: number;
  ad_points?: number; // Pontos farm (1000 pts = R$ 0,03)
  is_verified?: boolean; // Selo de verificado
  is_seller?: boolean; // É vendedor no marketplace
}

export interface Quota {
  id: string;
  userId: string;
  purchasePrice: number;
  currentValue: number;
  purchaseDate: string | number;
  status: 'ACTIVE' | 'SOLD' | 'PENDING';
  yieldRate?: number;
}

export interface Loan {
  id: string;
  userId: string;
  amount: number;
  totalRepayment: number;
  installments: number;
  interestRate: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'PAYMENT_PENDING';
  createdAt: string;
  dueDate?: string;

  totalPaid?: number;
  remainingAmount?: number;
  paidInstallmentsCount?: number;
  isFullyPaid?: boolean;
  userName?: string;
  userEmail?: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  created_at?: string;
  requestDate?: number; // timestamp
}

export interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  date?: string;
  created_at?: string;
  metadata?: any;
  user_name?: string;
  user_email?: string;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  quotas: Quota[];
  loans: Loan[];
  transactions: Transaction[];
  systemBalance: number;
  profitPool: number;
  isLoading?: boolean;

  serverTime?: number;
  lastDividendDistribution?: any;
  stats?: {
    quotasCount?: number;
    totalLoaned?: number;
    totalToReceive?: number;
    totalGatewayCosts?: number;
    totalManualCosts?: number;
    totalTaxReserve?: number;
    totalOperationalReserve?: number;
    totalOwnerProfit?: number;
    realLiquidity?: number;
    totalReserves?: number;
    theoreticalCash?: number;
    monthlyFixedCosts?: number;
    usersCount?: number;
    activeProposalsCount?: number;
    systemConfig?: any; // To avoid lint errors when accessing raw config
  };
  welcomeBenefit?: {
    hasDiscount: boolean;
    usesRemaining: number;
    maxUses: number;
    description: string;
    discountedRates: any;
  };
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  affiliateUrl: string;
  price?: number;
  category: string;
  active: boolean;
  createdAt: string;
}