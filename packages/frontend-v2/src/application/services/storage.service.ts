import { User, Quota, Loan, Transaction, AppState } from '../../domain/types/common.types';
import { apiService } from './api.service';
export { apiService };
import { syncService } from './sync.service';
// Imports removed as they were unused


// Função para converter dados da API para o formato esperado pelo frontend
const convertApiUserToUser = (apiUser: any): User => {
  if (!apiUser) {
    return {
      id: '',
      name: 'Usuário',
      email: '',
      pixKey: '',
      balance: 0,
      joinedAt: new Date().toISOString(),
      referralCode: '',
      isAdmin: false,
    };
  }

  return {
    id: String(apiUser.id || apiUser.userId || ''),
    name: apiUser.name || 'Usuário',
    email: apiUser.email || '',
    secretPhrase: '', // Não é retornado pela API
    pixKey: apiUser.pixKey || apiUser.pix_key || '',
    passwordHash: apiUser.passwordHash || apiUser.password_hash || '',
    balance: typeof apiUser.balance === 'string' ? parseFloat(apiUser.balance) : (apiUser.balance || 0),
    joinedAt: apiUser.joinedAt || apiUser.created_at || new Date().toISOString(),
    referralCode: apiUser.referralCode || apiUser.referral_code || '',
    isAdmin: apiUser.isAdmin || apiUser.is_admin || apiUser.role === 'ADMIN' || false,
    score: apiUser.score ?? 0,
    two_factor_enabled: apiUser.twoFactorEnabled || apiUser.two_factor_enabled || false,
    cpf: apiUser.cpf || null,
    phone: apiUser.phone || null,
    // Campos adicionais que o backend retorna
    membership_type: apiUser.membership_type || 'FREE',
    is_verified: apiUser.is_verified || false,
    video_points: apiUser.video_points || 0,
    ad_points: apiUser.ad_points || 0,
    role: apiUser.role || 'MEMBER',
    status: apiUser.status || 'ACTIVE',
    securityLockUntil: apiUser.security_lock_until ? new Date(apiUser.security_lock_until).getTime() : undefined,
    is_seller: apiUser.is_seller || false,
    total_dividends_earned: apiUser.total_dividends_earned || 0,
    last_login_at: apiUser.last_login_at,
    safeContactPhone: apiUser.safeContactPhone || apiUser.safe_contact_phone || null,
  };
};

const convertApiQuotaToQuota = (apiQuota: any): Quota => {
  const purchasePrice = typeof apiQuota.purchasePrice === 'string'
    ? parseFloat(apiQuota.purchasePrice)
    : (apiQuota.purchasePrice || 0);
  const currentValue = typeof apiQuota.currentValue === 'string'
    ? parseFloat(apiQuota.currentValue)
    : (apiQuota.currentValue || 0);
  const yieldRate = typeof apiQuota.yieldRate === 'string'
    ? parseFloat(apiQuota.yieldRate)
    : (apiQuota.yieldRate || 0);

  return {
    id: apiQuota.id,
    userId: String(apiQuota.userId || apiQuota.user_id || ''),
    purchasePrice: purchasePrice,
    purchaseDate: apiQuota.purchaseDate || apiQuota.purchase_date,
    currentValue: currentValue,
    yieldRate: yieldRate,
    status: apiQuota.status || 'ACTIVE',
  };
};

const convertApiLoanToLoan = (apiLoan: any): Loan => {
  // Garantir que os valores monetários sejam números válidos
  const amount = typeof apiLoan.amount === 'string'
    ? parseFloat(apiLoan.amount)
    : apiLoan.amount;
  const totalRepayment = typeof apiLoan.totalRepayment === 'string'
    ? parseFloat(apiLoan.totalRepayment)
    : apiLoan.totalRepayment;
  const interestRate = typeof apiLoan.interestRate === 'string'
    ? parseFloat(apiLoan.interestRate)
    : apiLoan.interestRate;
  const totalPaid = typeof apiLoan.totalPaid === 'string'
    ? parseFloat(apiLoan.totalPaid)
    : (apiLoan.totalPaid !== undefined && apiLoan.totalPaid !== null ? apiLoan.totalPaid : 0);

  const remainingAmount = typeof apiLoan.remainingAmount === 'string'
    ? parseFloat(apiLoan.remainingAmount)
    : (apiLoan.remainingAmount !== undefined && apiLoan.remainingAmount !== null
      ? apiLoan.remainingAmount
      : Math.max(0, totalRepayment - totalPaid));

  return {
    id: String(apiLoan.id || ''),
    userId: String(apiLoan.userId || apiLoan.user_id || ''),
    amount: amount || 0,
    totalRepayment: totalRepayment || 0,
    installments: apiLoan.installments || 1,
    interestRate: interestRate || 0,
    requestDate: apiLoan.requestDate,
    status: apiLoan.status,
    dueDate: apiLoan.dueDate,
    createdAt: apiLoan.createdAt || apiLoan.created_at || new Date().toISOString(),
    totalPaid: totalPaid,
    remainingAmount: remainingAmount,
    paidInstallmentsCount: apiLoan.paidInstallmentsCount || 0,
    isFullyPaid: apiLoan.isFullyPaid || false,
  };
};

const convertApiTransactionToTransaction = (apiTransaction: any): Transaction => {
  // Garantir que o amount seja um número válido
  const amount = typeof apiTransaction.amount === 'string'
    ? parseFloat(apiTransaction.amount)
    : apiTransaction.amount;

  return {
    id: apiTransaction.id,
    userId: String(apiTransaction.userId || apiTransaction.user_id || ''),
    type: apiTransaction.type,
    amount: amount || 0,
    date: apiTransaction.date || apiTransaction.created_at,
    description: apiTransaction.description,
    status: apiTransaction.status,
    metadata: apiTransaction.metadata,
    created_at: apiTransaction.created_at,
  };
};

// Cache para dashboard administrativo
let cachedDashboard: any = null;
let lastDashboardCacheTime = 0;
let isFetchingDashboard = false;
const DASHBOARD_CACHE_DURATION = 30000; // 30 segundos de cache para dashboard

// Carregar estado da aplicação da API
export const loadState = async (): Promise<AppState> => {
  try {
    // Verificar se o usuário está autenticado
    if (!apiService.isAuthenticated()) {
      return {
        currentUser: null,
        users: [],
        quotas: [],
        loans: [],
        transactions: [],
        systemBalance: 0,
        profitPool: 0,
      };
    }

    // Obter dados consolidados (Otimização Máxima)
    // Cache busting adicionado para forçar atualização em tempo real
    const syncResponse = await apiService.get<any>(`/users/sync?t=${Date.now()}`);
    const syncData = syncResponse.data;

    const currentUser = convertApiUserToUser(syncData.user);
    const transactions = syncData.transactions.map(convertApiTransactionToTransaction);
    const quotas = syncData.quotas.map(convertApiQuotaToQuota);
    const loans = syncData.loans.map(convertApiLoanToLoan);
    const welcomeBenefit = syncData.welcomeBenefit;
    let stats = syncData.stats;

    // Se for administrador, obter dados do dashboard
    let systemBalance = 0;
    let profitPool = 0;

    if (currentUser.isAdmin) {
      try {
        const now = Date.now();

        // Verificar cache para evitar requisições excessivas
        if (cachedDashboard && (now - lastDashboardCacheTime) < DASHBOARD_CACHE_DURATION) {
          console.log('Usando cache do dashboard administrativo');
          systemBalance = cachedDashboard.systemBalance || 0;
          profitPool = cachedDashboard.profitPool || 0;
          stats = cachedDashboard.stats || null;
        } else if (!isFetchingDashboard) {
          isFetchingDashboard = true;
          console.log('Buscando dashboard administrativo...');
          const dashboard = await apiService.getAdminDashboard();

          // Log removido para evitar erro de circularidade em objetos grandes
          console.log('Dados do dashboard administrativo carregados.');

          // Acessar dados aninhados corretamente
          systemBalance = dashboard.data?.systemConfig?.system_balance || dashboard.systemConfig?.system_balance || 0;
          profitPool = dashboard.data?.systemConfig?.profit_pool || dashboard.systemConfig?.profit_pool || 0;
          stats = dashboard.data?.stats || dashboard.stats || null;

          if (stats) {
            stats.totalGatewayCosts = dashboard.data?.systemConfig?.total_gateway_costs || dashboard.systemConfig?.total_gateway_costs || 0;
            stats.totalManualCosts = dashboard.data?.systemConfig?.total_manual_costs || dashboard.systemConfig?.total_manual_costs || 0;
            stats.totalTaxReserve = dashboard.data?.systemConfig?.total_tax_reserve || dashboard.systemConfig?.total_tax_reserve || 0;
            stats.totalOperationalReserve = dashboard.data?.systemConfig?.total_operational_reserve || dashboard.systemConfig?.total_operational_reserve || 0;
            stats.totalOwnerProfit = dashboard.data?.systemConfig?.total_owner_profit || dashboard.systemConfig?.total_owner_profit || 0;
            stats.realLiquidity = dashboard.data?.systemConfig?.real_liquidity || dashboard.systemConfig?.real_liquidity || 0;
            stats.totalReserves = dashboard.data?.systemConfig?.total_reserves || dashboard.systemConfig?.total_reserves || 0;
            stats.theoreticalCash = dashboard.data?.systemConfig?.theoretical_cash || dashboard.systemConfig?.theoretical_cash || 0;
            stats.monthlyFixedCosts = dashboard.data?.systemConfig?.monthly_fixed_costs || dashboard.systemConfig?.monthly_fixed_costs || 0;
            stats.systemConfig = dashboard.data?.systemConfig || dashboard.systemConfig || null;
            if (dashboard.data?.stats?.users_count !== undefined) {
              stats.usersCount = parseInt(dashboard.data.stats.users_count);
            }
          }

          // DEBUG: Verificar valores extraídos
          console.log('DEBUG - Valores extraídos:', {
            systemBalance,
            profitPool,
            stats,
            'dashboard.systemConfig?.system_balance': dashboard.systemConfig?.system_balance,
            'dashboard.systemConfig?.profit_pool': dashboard.systemConfig?.profit_pool
          });

          // Atualizar cache do dashboard
          cachedDashboard = { systemBalance, profitPool, stats };
          lastDashboardCacheTime = now;

          console.log('Dashboard completo recebido e cache atualizado:', dashboard);
        }
      } catch (error) {
        console.error('Erro ao carregar dashboard administrativo:', error);
        // Limpar cache em caso de erro para forçar nova busca
        cachedDashboard = null;
        lastDashboardCacheTime = 0;
      } finally {
        isFetchingDashboard = false;
      }
    }

    // NÃO carregar todos os usuários aqui (economia de banda). 
    // A lista de usuários será carregada sob demanda na aba de Gestão de Usuários.
    let allUsers: User[] = [currentUser].filter(Boolean) as User[];

    return {
      currentUser,
      users: allUsers,
      quotas,
      loans,
      transactions,
      systemBalance,
      profitPool,
      stats,
      welcomeBenefit,
    };
  } catch (error: any) {
    // Suppress logging for auth errors (expected during logout/expiry)
    if (!error.message?.includes('Token') && !error.message?.includes('401')) {
      console.error('Erro ao carregar estado da aplicação:', error);
    }

    // Em caso de erro, retornar estado padrão
    return {
      currentUser: null,
      users: [],
      quotas: [],
      loans: [],
      transactions: [],
      systemBalance: 0,
      profitPool: 0,
    };
  }
};

// Salvar estado da aplicação (não necessário com API, mas mantido para compatibilidade)
export const saveState = (_state: AppState): void => {
  // Com a API, não precisamos salvar o estado no localStorage
  // Esta função é mantida apenas para compatibilidade com o código existente
  console.log('saveState chamado, mas não é necessário com API');
};

// --- Admin Logic ---



export const updateProfitPool = async (amountToAdd: number): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiService.addProfitToPool(amountToAdd);
    // Limpar cache após atualização
    clearPendingItemsCache();
    return { success: true, message: response.message || 'Excedente adicionado com sucesso!' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao adicionar excedente.' };
  }
};

// CACHE_DURATION removed as it was unused


// Função para limpar o cache quando necessário (ex: após atualização de dividendos)
export const clearPendingItemsCache = (): void => {
  cachedDashboard = null;
  lastDashboardCacheTime = 0;
  console.log('Cache do dashboard limpo');
};

// Função para limpar apenas o cache do dashboard
export const clearDashboardCache = (): void => {
  cachedDashboard = null;
  lastDashboardCacheTime = 0;
  console.log('Cache do dashboard limpo');
};

// Função para limpar cache globalmente
export const clearAllCache = (): void => {
  cachedDashboard = null;
  lastDashboardCacheTime = 0;
  console.log('Todo o cache foi limpo');
};



export const distributeMonthlyDividends = async () => {
  const result = await apiService.distributeDividends();
  return result;
};

// --- User Logic ---

export const requestDeposit = async (amount: number, senderName?: string): Promise<any> => {
  return await apiService.requestDeposit(amount, senderName);
};

export const buyQuota = async (quantity: number, useBalance: boolean = false, paymentMethod?: 'pix'): Promise<any> => {
  if (!navigator.onLine) {
    return await syncService.enqueue('BUY_QUOTA', { quantity, useBalance, paymentMethod });
  }
  return await apiService.buyQuotas(quantity, useBalance, paymentMethod);
};

export const sellQuota = async (quotaId: string): Promise<any> => {
  return await apiService.sellQuota(quotaId);
};

export const sellAllQuotas = async (): Promise<any> => {
  return await apiService.sellAllQuotas();
};

export const requestLoan = async (
  amount: number,
  installments: number,
  guaranteePercentage: number = 100,
  guarantorId?: string
): Promise<any> => {
  if (!navigator.onLine) {
    return await syncService.enqueue('REQUEST_LOAN', { amount, installments, guaranteePercentage, guarantorId });
  }
  return await apiService.requestLoan(amount, installments, guaranteePercentage, guarantorId);
};

export const respondToGuarantorRequest = async (loanId: string, action: 'APPROVE' | 'REJECT'): Promise<any> => {
  return await apiService.respondToGuarantorRequest(loanId, action);
};

export const repayLoan = async (loanId: string, useBalance: boolean, paymentMethod?: 'pix'): Promise<any> => {
  if (!navigator.onLine) {
    return await syncService.enqueue('REPAY_LOAN', { loanId, useBalance, paymentMethod });
  }
  return await apiService.repayLoan(loanId, useBalance, paymentMethod);
};

export const repayInstallment = async (loanId: string, amount: number, useBalance: boolean, paymentMethod?: 'pix'): Promise<any> => {
  if (!navigator.onLine) {
    return await syncService.enqueue('REPAY_INSTALLMENT', { loanId, amount, useBalance, paymentMethod });
  }
  return await apiService.repayInstallment(loanId, amount, useBalance, paymentMethod);
};

export const requestWithdrawal = async (amount: number, pixKey: string): Promise<any> => {
  return await apiService.requestWithdrawal(amount, pixKey);
};

export const claimAdReward = async (): Promise<any> => {
  if (!navigator.onLine) {
    return await syncService.enqueue('CLAIM_AD_REWARD', {});
  }
  return await apiService.claimAdReward();
};

export const upgradePro = async (method: 'pix' | 'balance'): Promise<any> => {
  return await apiService.post<any>('/monetization/upgrade-pro', { method });
};

export const fastForwardTime = async (_months: number): Promise<void> => {
  console.log('Simulação de tempo desativada.');
};

// --- Auth ---

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  pixKey: string,
  secretPhrase: string,
  phone: string,
  referralCodeInput?: string,
  cpf?: string
): Promise<any> => {
  const response = await apiService.register(
    name,
    email,
    password,
    secretPhrase,
    pixKey,
    phone,
    referralCodeInput,
    cpf
  );
  return {
    user: convertApiUserToUser(response.data?.user),
    twoFactor: response.data?.twoFactor
  };
};

export const changePassword = async (oldPass: string, newPass: string): Promise<void> => {
  await apiService.changePassword(oldPass, newPass);
};

export const loginUser = async (
  email: string,
  password: string,
  secretPhrase?: string,
  twoFactorCode?: string
): Promise<any> => {
  const response = await apiService.login(email, password, secretPhrase, twoFactorCode);
  if (response.data?.requires2FA) return response.data;
  return convertApiUserToUser(response.data?.user);
};

export const loginWithGoogle = async (idToken: string): Promise<any> => {
  const response = await apiService.loginWithGoogle(idToken);
  return {
    user: convertApiUserToUser(response.data?.user),
    isNewUser: response.data?.isNewUser
  };
};

export const resetPassword = async (
  email: string,
  secretPhrase: string,
  newPassword: string
): Promise<void> => {
  await apiService.resetPassword(email, secretPhrase, newPassword);
};

export const logoutUser = async (): Promise<void> => {
  await apiService.logout();
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    if (!apiService.isAuthenticated()) {
      return null;
    }

    const response = await apiService.getUserProfile();
    return convertApiUserToUser(response.data?.user);
  } catch (error) {
    console.error('Erro ao obter usuário atual:', error);
    return null;
  }
};



export const get2FASetup = () => apiService.get2FASetup();

export const verify2FA = (token: string, secret: string) => apiService.verify2FA(token, secret);

export const confirmWithdrawal = (transactionId: number, code: string, password: string) => apiService.confirmWithdrawal(transactionId, code, password);

export const deleteUserAccount = async (twoFactorCode?: string): Promise<any> => {
  const result = await apiService.deleteAccount(twoFactorCode);
  if (result.success) {
    await logoutUser();
  }
  return result;
};