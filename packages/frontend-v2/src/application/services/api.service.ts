// URL base da API - detecta se está acessando via ngrok
const getApiBaseUrl = () => {
  const currentUrl = window.location.origin;
  if (currentUrl.includes('ngrok-free.app')) {
    // Se estiver acessando via ngrok, usa a mesma URL base para a API
    return currentUrl + '/api';
  }
  return (import.meta as any).env.VITE_API_URL || '/api';
};

const API_BASE_URL = getApiBaseUrl();

// Tipos para respostas da API
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  [key: string]: any; // Permite campos extras como userCurrentPower, requiresVerification, etc.
}

interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    pixKey: string;
    balance: number;
    joinedAt: number;
    referralCode: string;
    isAdmin?: boolean;
  };
  token: string;
}

// Classe para gerenciar requisições à API
class ApiService {
  private token: string | null = null;

  constructor() {
    // Recuperar token do localStorage ao inicializar
    this.token = localStorage.getItem('authToken');
  }

  // Verificar se o usuário está autenticado
  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Método privado para obter headers comuns
  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Método privado para fazer requisições
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      console.log('[API] Making request to:', url, 'Method:', config.method || 'GET');
      const response = await fetch(url, config);

      // Tentar fazer parse do JSON apenas se o content-type for application/json
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // Se não for JSON, tentar obter como texto
        const text = await response.text();
        try {
          // Tentar fazer parse do texto como JSON (fallback)
          data = JSON.parse(text);
        } catch {
          // Se não for JSON, criar um objeto de erro padrão
          data = { message: text || 'Erro na requisição' };
        }
      }

      if (!response.ok) {
        // Se for erro 401 (Não autorizado), limpar token e redirecionar para login
        // Se for erro 404 (Não encontrado) NA ROTA DE PERFIL ou BALANCE, significa que o usuário do token foi deletado
        if (response.status === 401 || (response.status === 404 && (endpoint === '/users/profile' || endpoint === '/users/balance'))) {
          console.log(`Erro ${response.status} detectado em ${endpoint}. Forçando logout.`);
          this.token = null;
          localStorage.removeItem('authToken');
          // Disparar evento para notificar o app sobre o logout
          window.dispatchEvent(new CustomEvent('auth-expired'));
        }
        // Lançar um erro que contenha as informações extras da resposta (ex: requiresVerification)
        const error: any = new Error(data.message || 'Erro na requisição');
        Object.assign(error, data);
        throw error;
      }

      return data;
    } catch (error: any) {
      if (error.name === 'TypeError' && !navigator.onLine) {
        error.message = 'Sua conexão com a internet caiu. O App exibirá dados salvos quando possível.';
      }
      console.error('Erro na requisição:', error);
      throw error;
    }
  }

  // Método genérico para POST
  async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Método genérico para GET
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
    });
  }

  // Método genérico para PUT
  async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // Método genérico para DELETE
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // Método genérico para PATCH
  async patch<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  // Método para login
  async login(email: string, password: string, secretPhrase?: string, twoFactorCode?: string): Promise<AuthResponse & { requires2FA?: boolean }> {
    const response = await this.request<AuthResponse & { requires2FA?: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, secretPhrase, twoFactorCode }),
    });

    if (response.data?.requires2FA) {
      return response.data;
    }

    // Armazenar token
    this.token = response.data?.token || null;
    if (this.token) {
      localStorage.setItem('authToken', this.token);
    }

    return response.data!;
  }

  // Método para registro
  async register(
    name: string,
    email: string,
    password: string,
    secretPhrase: string,
    pixKey: string,
    phone: string,
    referralCode?: string,
    cpf?: string
  ): Promise<AuthResponse & { twoFactor?: { secret: string, qrCode: string, otpUri: string } }> {
    const requestBody: any = { name, email, password, secretPhrase, pixKey, phone };
    if (referralCode && referralCode.trim() !== '') {
      requestBody.referralCode = referralCode;
    }
    if (cpf && cpf.trim() !== '') {
      requestBody.cpf = cpf.replace(/\D/g, ''); // Apenas números
    }

    const response = await this.request<AuthResponse & { twoFactor?: { secret: string, qrCode: string, otpUri: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    // Armazenar token
    this.token = response.data?.token || null;
    if (this.token) {
      localStorage.setItem('authToken', this.token);
    }

    return response.data!;
  }

  // Obter dados de configuração 2FA
  async get2FASetup(): Promise<any> {
    const response = await this.request<any>('/auth/2fa/setup');
    return response.data;
  }

  // Método para reset de senha
  async resetPassword(email: string, secretPhrase: string, newPassword: string): Promise<void> {
    await this.request<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, secretPhrase, newPassword }),
    });
  }

  // Método para recuperar 2FA (quando perdeu o autenticador)
  async recover2FA(email: string, password: string, secretPhrase: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      twoFactor: {
        secret: string;
        qrCode: string;
        otpUri: string;
      }
    }
  }> {
    return this.request<any>('/auth/recover-2fa', {
      method: 'POST',
      body: JSON.stringify({ email, password, secretPhrase }),
    });
  }

  // Método para logout
  async logout(): Promise<void> {
    await this.request<void>('/auth/logout', {
      method: 'POST',
    });

    // Remover token
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // Atualizar CPF do usuário
  async updateCpf(cpf: string): Promise<{ success: boolean; message: string }> {
    const response = await this.request<{ success: boolean; message: string }>('/users/update-cpf', {
      method: 'POST',
      body: JSON.stringify({ cpf }),
    });

    if (!response.success && response.message) {
      throw new Error(response.message);
    }

    return response.data || { success: true, message: 'CPF atualizado com sucesso!' };
  }

  // Atualizar telefone do usuário
  async updatePhone(phone: string): Promise<{ success: boolean; message: string }> {
    const response = await this.request<{ success: boolean; message: string }>('/users/update-phone', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });

    if (!response.success && response.message) {
      throw new Error(response.message);
    }

    return response.data || { success: true, message: 'Telefone atualizado com sucesso!' };
  }

  // Método para obter perfil do usuário
  async getUserProfile(): Promise<any> {
    const response = await this.request<any>('/users/profile');
    return response.data;
  }

  // Método para atualizar perfil do usuário
  async updateUserProfile(data: {
    name?: string;
    pixKey?: string;
    secretPhrase?: string;
  }): Promise<any> {
    const response = await this.request<any>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  // Método para obter saldo do usuário
  async getUserBalance(): Promise<{ balance: number }> {
    const response = await this.request<{ balance: number }>('/users/balance');
    return response.data!;
  }

  // Método para obter transações do usuário com paginação
  async getUserTransactions(options?: { limit?: number, offset?: number }): Promise<any> {
    const query = new URLSearchParams();
    if (options?.limit) query.append('limit', options.limit.toString());
    if (options?.offset) query.append('offset', options.offset.toString());

    const response = await this.request<any>(`/users/transactions?${query.toString()}`);
    return response;
  }

  // Método para registrar intenção de depósito manual
  async requestDeposit(amount: number): Promise<any> {
    const response = await this.request<any>('/transactions/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
    return response.data;
  }

  // Método para obter cotas do usuário
  async getUserQuotas(): Promise<{ quotas: any[] }> {
    const response = await this.request<{ quotas: any[] }>('/quotas');
    return response.data!;
  }

  // Método para reivindicar recompensa por anúncio
  async claimAdReward(): Promise<any> {
    const response = await this.request<any>('/users/reward-ad', { method: 'POST' });
    return response.data!;
  }

  // Método para comprar cotas (PIX manual ou saldo)
  async buyQuotas(quantity: number, useBalance: boolean, paymentMethod?: 'pix'): Promise<any> {
    console.log('[FRONTEND] buyQuotas called with:', { quantity, useBalance, paymentMethod });
    const response = await this.request<any>('/quotas/buy', {
      method: 'POST',
      body: JSON.stringify({
        quantity,
        useBalance,
        paymentMethod
      }),
    });
    return response.data;
  }

  // Método para vender uma cota
  async sellQuota(quotaId: string): Promise<any> {
    const response = await this.request<any>('/quotas/sell', {
      method: 'POST',
      body: JSON.stringify({ quotaId }),
    });
    return response.data;
  }

  // Método para vender todas as cotas
  async sellAllQuotas(): Promise<any> {
    const response = await this.request<any>('/quotas/sell-all', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return response.data;
  }

  // Método para obter empréstimos do usuário
  async getUserLoans(): Promise<{ loans: any[] }> {
    const response = await this.request<{ loans: any[] }>('/loans');
    return response.data!;
  }

  // Método para solicitar empréstimo
  async requestLoan(amount: number, installments: number): Promise<any> {
    const response = await this.request<any>('/loans/request', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        installments,
      }),
    });
    return response.data;
  }

  // Método para pagar empréstimo (PIX manual ou saldo)
  async repayLoan(loanId: string, useBalance: boolean, paymentMethod?: 'pix'): Promise<any> {
    const response = await this.request<any>('/loans/repay', {
      method: 'POST',
      body: JSON.stringify({ loanId, useBalance, paymentMethod }),
    });
    return response.data;
  }

  // Método para pagar parcela de empréstimo (PIX manual ou saldo)
  async repayInstallment(loanId: string, amount: number, useBalance: boolean, paymentMethod?: 'pix'): Promise<any> {
    const response = await this.request<any>('/loans/repay-installment', {
      method: 'POST',
      body: JSON.stringify({
        loanId,
        installmentAmount: amount,
        useBalance,
        paymentMethod
      }),
    });
    return response.data;
  }

  // Método para solicitar saque
  async requestWithdrawal(amount: number, pixKey: string): Promise<any> {
    const response = await this.request<any>('/withdrawals/request', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        pixKey
      }),
    });
    return response; // Return full response to check requiresConfirmation
  }


  // Método para excluir conta
  async deleteAccount(twoFactorCode?: string): Promise<any> {
    const response = await this.request<any>('/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ twoFactorCode }),
    });
    return response;
  }

  // Métodos administrativos
  async getAdminDashboard(): Promise<any> {
    const response = await this.request<any>('/admin/dashboard');
    return response.data;
  }

  async getHealthMetrics(): Promise<any> {
    const response = await this.request<any>('/admin/metrics/health');
    return response.data;
  }

  async addProfitToPool(amountToAdd: number): Promise<ApiResponse<void>> {
    return await this.request<void>('/admin/profit-pool', {
      method: 'POST',
      body: JSON.stringify({ amountToAdd }),
    });
  }



  async distributeDividends(): Promise<any> {
    const response = await this.request<any>('/admin/distribute-dividends', {
      method: 'POST',
    });
    return response.data;
  }





  // --- GOVERNANÇA (VOTAÇÃO) ---
  async getProposals(): Promise<any> {
    return await this.request<any>('/voting/proposals');
  }

  async createProposal(title: string, description: string): Promise<any> {
    return await this.request<any>('/voting/proposal', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
  }

  async closeProposal(proposalId: number): Promise<any> {
    return await this.request<any>(`/voting/proposal/${proposalId}/close`, {
      method: 'POST',
    });
  }

  // Fila de Pagamentos (Payout Queue)
  async getPayoutQueue(): Promise<any> {
    const response = await this.request<any>('/admin/payout-queue');
    return response.data;
  }

  async confirmPayout(id: string, type: 'TRANSACTION' | 'LOAN'): Promise<void> {
    await this.request<void>('/admin/confirm-payout', {
      method: 'POST',
      body: JSON.stringify({ id, type }),
    });
  }

  // Listar transações aguardando aprovação
  async getPendingTransactions(): Promise<any> {
    const response = await this.request<any>('/admin/pending-transactions');
    return response.data;
  }

  // Aprovar ou rejeitar uma transação/empréstimo
  async processAction(id: string | number, type: 'TRANSACTION' | 'LOAN', action: 'APPROVE' | 'REJECT'): Promise<any> {
    return await this.request<any>('/admin/process-action', {
      method: 'POST',
      body: JSON.stringify({ id, type, action }),
    });
  }

  // --- AVALIAÇÕES DE TRANSAÇÕES ---
  async submitReview(transactionId: number, rating: number, comment: string, isPublic: boolean): Promise<any> {
    return await this.request<any>('/transactions/review', {
      method: 'POST',
      body: JSON.stringify({ transactionId, rating, comment, isPublic }),
    });
  }

  async getPendingReviews(): Promise<any> {
    return await this.request<any>('/transactions/pending-reviews');
  }

  async getPublicTestimonials(): Promise<any> {
    return await this.request<any>('/transactions/reviews/public');
  }

  // --- ADMIN: Gerenciamento de Avaliações ---
  async getAdminReviews(): Promise<any> {
    return await this.request<any>('/admin/reviews');
  }

  async approveReview(reviewId: number): Promise<any> {
    return await this.request<any>(`/admin/reviews/${reviewId}/approve`, {
      method: 'POST',
    });
  }

  async rejectReview(reviewId: number): Promise<any> {
    return await this.request<any>(`/admin/reviews/${reviewId}/reject`, {
      method: 'POST',
    });
  }

  // Obter limite de crédito disponível (Estilo Nubank)



  // Obter limite de crédito disponível (Estilo Nubank)
  async getAvailableLimit(): Promise<{ totalLimit: number; activeDebt: number; remainingLimit: number; analysis?: any }> {
    const response = await this.request<any>('/loans/available-limit', {
      method: 'GET',
    });
    return response.data;
  }

  // Obter carteira de crédito do cliente
  async getCreditPortfolio(userId: string): Promise<any> {
    const response = await this.request<any>(`/admin/credit-portfolio/${userId}`);
    return response.data;
  }

  // --- Loja de Produtos (Afiliados) ---

  async getProducts(category?: string): Promise<any[]> {
    const params = category ? `?category=${category}` : '';
    const response = await this.request<any[]>('/products' + params);
    return response.data || [];
  }

  async getAllProductsAdmin(): Promise<any[]> {
    const response = await this.request<any[]>('/products/admin/all');
    return response.data || [];
  }

  // Método para verificar 2FA (Ativação)
  async verify2FA(email: string, code: string): Promise<any> {
    return this.request<any>('/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ email, code })
    });
  }

  // Método para confirmar saque via 2FA
  async confirmWithdrawal(transactionId: number, code: string): Promise<any> {
    return this.request<any>('/withdrawals/confirm', {
      method: 'POST',
      body: JSON.stringify({ transactionId, code })
    });
  }

  async createProduct(data: any): Promise<any> {
    const response = await this.request<any>('/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.data!;
  }

  async updateProduct(id: string, data: any): Promise<any> {
    const response = await this.request<any>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.data!;
  }

  async deleteProduct(id: string): Promise<void> {
    await this.request<void>(`/products/${id}`, {
      method: 'DELETE'
    });
  }

  async fetchProductMetadata(url: string): Promise<{ title: string; description: string; imageUrl: string; price?: number }> {
    const response = await this.request<any>('/products/fetch-metadata', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    return response.data;
  }

  // Alterar senha
  async changePassword(oldPassword: string, newPassword: string): Promise<any> {
    return this.request<any>('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword })
    });
  }

  // Notificações em tempo real (SSE) - DESATIVADO TEMPORARIAMENTE PARA ESTABILIDADE
  listenToNotifications(_onNotification: (data: any) => void): () => void {
    return () => { };
  }

  // --- Título de Sócio Majoritário ---
  async checkTitleEligibility(): Promise<{ eligible: boolean, message?: string, reason?: string, currentCount?: number, neededCount?: number, daysRemaining?: number }> {
    const response = await this.request<any>('/users/title-eligibility');
    return response.data;
  }

  async downloadTitle(): Promise<any> {
    const response = await this.request<any>('/users/title-download', { method: 'POST' });
    return response.data;
  }

  // --- Benefício de Boas-Vindas (Indicação) ---
  async getWelcomeBenefit(): Promise<{
    hasDiscount: boolean;
    usesRemaining: number;
    maxUses: number;
    description: string;
    discountedRates: {
      loanInterestRate: string;
      loanOriginationFeeRate: string;
      withdrawalFee: string;
      marketplaceEscrowFeeRate: string;
    } | null;
    normalRates: {
      loanInterestRate: string;
      loanOriginationFeeRate: string;
      withdrawalFee: string;
      marketplaceEscrowFeeRate: string;
    };
  }> {
    const response = await this.request<any>('/users/welcome-benefit');
    return response.data;
  }

  // --- Gestão de Equipe e Usuários (Admin) ---
  async adminGetUsers(options?: { search?: string, role?: string, status?: string, limit?: number, offset?: number }): Promise<any> {
    const query = new URLSearchParams();
    if (options?.search) query.append('search', options.search);
    if (options?.role) query.append('role', options.role);
    if (options?.status) query.append('status', options.status);
    if (options?.limit) query.append('limit', options.limit.toString());
    if (options?.offset) query.append('offset', options.offset.toString());

    const response = await this.request<any>(`/admin/users?${query.toString()}`);
    return response;
  }

  async adminUpdateUserAccess(data: { userId: number, role?: string, status?: string }): Promise<any> {
    const response = await this.request<any>('/admin/users/update-access', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response;
  }

  async adminCreateAttendant(data: any): Promise<any> {
    const response = await this.request<any>('/admin/users/create-attendant', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response;
  }

  // Limpeza de anúncios antigos do marketplace
  async getMarketplaceCleanupStats(): Promise<{
    stale7Days: number;
    stale14Days: number;
    stale30Days: number;
    boostedActive: number;
    totalActive: number;
    totalAll: number;
  }> {
    const response = await this.request<any>('/admin/marketplace/cleanup-stats');
    return response.data;
  }

  async cleanupOldListings(daysOld: number = 7): Promise<{
    deletedCount: number;
    skipped: number;
    daysOld: number;
    message: string;
  }> {
    const response = await this.request<any>('/admin/marketplace/cleanup-old-listings', {
      method: 'POST',
      body: JSON.stringify({ daysOld })
    });
    return { ...response.data, message: response.message };
  }

  // ==================== BUG REPORTS ====================

  // Criar um bug report
  async createBugReport(data: {
    title: string;
    description: string;
    category?: 'general' | 'payment' | 'ui' | 'performance' | 'other';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    deviceInfo?: string;
  }): Promise<any> {
    const response = await this.request<any>('/bugs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response;
  }

  // Listar meus bug reports
  async getMyBugReports(): Promise<any> {
    const response = await this.request<any>('/bugs/my');
    return response.data;
  }

  // Admin: listar todos os bugs
  async getAdminBugReports(status?: string): Promise<any> {
    const query = status ? `?status=${status}` : '';
    const response = await this.request<any>(`/bugs/admin${query}`);
    return response;
  }

  // Admin: atualizar status de um bug
  async updateBugStatus(bugId: number, status: string, adminNotes?: string): Promise<any> {
    const response = await this.request<any>(`/bugs/admin/${bugId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNotes })
    });
    return response;
  }

  // Admin: deletar um bug
  async deleteBugReport(bugId: number): Promise<any> {
    const response = await this.request<any>(`/bugs/admin/${bugId}`, {
      method: 'DELETE'
    });
    return response;
  }

  // ==================== MONETIZAÇÃO PREMIUM ====================

  // Comprar selo de verificado
  async buyVerifiedBadge(): Promise<any> {
    const response = await this.request<any>('/monetization/buy-verified-badge', {
      method: 'POST'
    });
    return response;
  }

  // Comprar pacote de score boost
  async buyScoreBoost(): Promise<any> {
    const response = await this.request<any>('/monetization/buy-score-boost', {
      method: 'POST'
    });
    return response;
  }

  // Check-in diário
  async dailyCheckin(): Promise<any> {
    const response = await this.request<any>('/monetization/daily-checkin', {
      method: 'POST'
    });
    return response;
  }

  // Consulta de reputação
  async checkReputation(email: string): Promise<any> {
    const response = await this.request<any>(`/monetization/reputation-check/${encodeURIComponent(email)}`);
    return response;
  }

  // ==================== EARN - Baú Diário ====================

  // Abrir baú de fidelidade
  async openChestReward(amount: number): Promise<any> {
    const response = await this.request<any>('/earn/chest-reward', {
      method: 'POST',
      body: JSON.stringify({ amount })
    });
    return response;
  }

  // Status do baú
  async getChestStatus(): Promise<{ chestsRemaining: number; countdown: number; canOpen: boolean }> {
    const response = await this.request<any>('/earn/chest-status');
    return response.data;
  }

  // Recompensa por vídeo (rota earn)
  async earnVideoReward(videoId: string): Promise<any> {
    const response = await this.request<any>('/earn/video-reward', {
      method: 'POST',
      body: JSON.stringify({ videoId })
    });
    return response;
  }

  // ==================== SELLER (Vendedor) ====================

  // Verificar status de vendedor
  async getSellerStatus(): Promise<any> {
    const response = await this.request<any>('/seller/status');
    return response.data || response;
  }

  // Registrar como vendedor
  async registerSeller(data: {
    companyName: string;
    cpfCnpj: string;
    mobilePhone: string;
    address: string;
    addressNumber?: string;
    neighborhood?: string;
    city: string;
    state: string;
    postalCode: string;
    companyType?: string;
  }): Promise<any> {
    const response = await this.request<any>('/seller/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response;
  }

  // Obter wallet do vendedor
  async getSellerWallet(): Promise<any> {
    const response = await this.request<any>('/seller/wallet');
    return response.data || response;
  }

  // ========== PONTOS FARM ==========

  // Obter informações de pontos do usuário
  async getPointsInfo(): Promise<{
    currentPoints: number;
    canConvert: boolean;
    possibleConversion: number;
    pointsToNextConversion: number;
    rate: string;
  }> {
    const response = await this.request<any>('/earn/points-info');
    return response.data;
  }

  // Converter pontos para saldo
  async convertPoints(): Promise<{
    pointsConverted: number;
    moneyCredited: number;
    remainingPoints: number;
  }> {
    const response = await this.request<any>('/earn/convert-points', {
      method: 'POST'
    });
    return response.data;
  }

  // ==================== MARKETPLACE ====================

  // Listar anúncios do mercado
  async getMarketplaceListings(limit: number = 50, offset: number = 0): Promise<any> {
    const response = await this.request<any>(`/marketplace/listings?limit=${limit}&offset=${offset}`);
    return response.data;
  }

  // Criar novo anúncio
  async createMarketplaceListing(data: {
    title: string;
    description: string;
    price: number;
    category?: string;
    imageUrl?: string;
    quotaId?: number;
  }): Promise<any> {
    const response = await this.request<any>('/marketplace/create', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response;
  }

  // Comprar um anúncio
  async buyMarketplaceListing(data: {
    listingId: number;
    deliveryAddress?: string;
    contactPhone?: string;
    paymentMethod?: 'BALANCE' | 'PIX' | 'CARD';
    deliveryType?: 'SELF_PICKUP' | 'COURIER_REQUEST';
    offeredDeliveryFee?: number;
    pickupAddress?: string;
    payerCpfCnpj?: string;
    creditCard?: {
      holderName: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      ccv: string;
      cpf: string;
    };
  }): Promise<any> {
    const response = await this.request<any>('/marketplace/buy', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response;
  }

  // Comprar parcelado
  async buyMarketplaceOnCredit(data: {
    listingId: number;
    installments: number;
    deliveryAddress?: string;
    contactPhone?: string;
    deliveryType?: 'SELF_PICKUP' | 'COURIER_REQUEST';
    offeredDeliveryFee?: number;
    pickupAddress?: string;
  }): Promise<any> {
    const response = await this.request<any>('/marketplace/buy-on-credit', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response;
  }

  // Meus anúncios
  async getMyMarketplaceListings(): Promise<any> {
    const response = await this.request<any>('/marketplace/my-listings');
    return response.data;
  }

  // Meus pedidos (compras)
  async getMyMarketplaceOrders(): Promise<any> {
    const response = await this.request<any>('/marketplace/my-orders');
    return response.data;
  }

  // Minhas vendas
  async getMyMarketplaceSales(): Promise<any> {
    const response = await this.request<any>('/marketplace/my-sales');
    return response.data;
  }

  // Marcar pedido como enviado
  async shipMarketplaceOrder(orderId: number, trackingCode?: string): Promise<any> {
    const response = await this.request<any>(`/marketplace/order/${orderId}/ship`, {
      method: 'POST',
      body: JSON.stringify({ trackingCode })
    });
    return response;
  }

  // Confirmar recebimento do pedido
  async receiveMarketplaceOrder(orderId: number): Promise<any> {
    const response = await this.request<any>(`/marketplace/order/${orderId}/receive`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    return response;
  }

  // Cancelar anúncio
  async cancelMarketplaceListing(listingId: number): Promise<any> {
    const response = await this.request<any>(`/marketplace/listing/${listingId}/cancel`, {
      method: 'POST'
    });
    return response;
  }

  // Sugestão de descrição via IA
  async getMarketplaceAiSuggestion(title: string): Promise<{ description: string; category: string }> {
    const response = await this.request<any>('/marketplace/ai-assist', {
      method: 'POST',
      body: JSON.stringify({ title })
    });
    return response.data;
  }

  // Impulsionar anúncio
  async boostMarketplaceListing(listingId: number, days: number = 7): Promise<any> {
    const response = await this.request<any>('/marketplace/boost', {
      method: 'POST',
      body: JSON.stringify({ listingId, days })
    });
    return response;
  }

  // ==================== PROMO VIDEOS ====================

  // Listar tags disponíveis
  async getPromoVideoTags(): Promise<string[]> {
    const response = await this.request<any>('/promo-videos/tags');
    return response.data || [];
  }

  // Feed de vídeos disponíveis para assistir
  async getPromoVideoFeed(tag?: string): Promise<any[]> {
    const url = tag ? `/promo-videos/feed?tag=${tag}` : '/promo-videos/feed';
    const response = await this.request<any>(url);
    return response.data || [];
  }

  // Próximo vídeo para assistir (farm)
  async getNextPromoVideo(): Promise<any> {
    const response = await this.request<any>('/promo-videos/farm/next');
    return response;
  }

  // Criar campanha de vídeo
  async createPromoVideoCampaign(data: {
    title: string;
    description?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    platform?: 'YOUTUBE' | 'TIKTOK' | 'INSTAGRAM' | 'KWAI' | 'OTHER';
    tag?: string;
    durationSeconds?: number;
    minWatchSeconds?: number;
    budget: number;
    pricePerView?: number;
    paymentMethod: 'BALANCE' | 'PIX' | 'CARD';
    payerCpfCnpj?: string;
    cardData?: {
      holderName: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      ccv: string;
      cpf: string;
    };
  }): Promise<any> {
    const response = await this.request<any>('/promo-videos/create', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response;
  }

  // Buscar dados de pagamento de campanha pendente
  async getPromoVideoPayment(videoId: number): Promise<any> {
    const response = await this.request<any>(`/promo-videos/${videoId}/payment`);
    return response.data;
  }

  // Iniciar visualização de vídeo
  async startPromoVideoView(videoId: number): Promise<any> {
    const response = await this.request<any>(`/promo-videos/${videoId}/start-view`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    return response;
  }

  // Completar visualização e receber recompensa
  async completePromoVideoView(videoId: number, watchTimeSeconds: number): Promise<any> {
    const response = await this.request<any>(`/promo-videos/${videoId}/complete-view`, {
      method: 'POST',
      body: JSON.stringify({ watchTimeSeconds })
    });
    return response;
  }

  // Minhas campanhas
  async getMyPromoVideoCampaigns(): Promise<any[]> {
    const response = await this.request<any>('/promo-videos/my-campaigns');
    return response.data || [];
  }

  // Meus ganhos assistindo vídeos
  async getMyPromoVideoEarnings(): Promise<{
    totalEarned: number;
    currentPoints: number;
    videosWatched: number;
    conversionRate: number;
    minConversionPoints: number;
  }> {
    const response = await this.request<any>('/promo-videos/my-earnings');
    return response.data;
  }

  // Remover/cancelar campanha
  async deletePromoVideoCampaign(videoId: number): Promise<any> {
    const response = await this.request<any>(`/promo-videos/${videoId}`, {
      method: 'DELETE'
    });
    return response;
  }

  // Converter pontos de vídeo em dinheiro
  async convertPromoVideoPoints(): Promise<{
    convertedAmount: number;
    remainingPoints: number;
  }> {
    const response = await this.request<any>('/promo-videos/convert-points', {
      method: 'POST'
    });
    return response.data;
  }

  // ==================== EDUCATION ====================

  // Iniciar sessão de estudo
  async startEducationSession(lessonId: string | number): Promise<{ sessionId: number }> {
    const response = await this.request<any>('/education/start-session', {
      method: 'POST',
      body: JSON.stringify({ lessonId })
    });
    return response.data;
  }

  // Receber recompensa por estudo
  async claimEducationReward(data: {
    points: number;
    lessonId: string | number;
    sessionId: number;
  }): Promise<{
    transactionId: number;
    amount: number;
    scoreAdded: number;
  }> {
    const response = await this.request<any>('/education/reward', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  // ==================== LOGISTICS ====================

  // Listar entregas disponíveis
  async getAvailableDeliveries(): Promise<any[]> {
    const response = await this.request<any>('/logistics/available');
    return response.data || [];
  }

  // Aceitar uma entrega
  async acceptDelivery(orderId: number): Promise<any> {
    const response = await this.request<any>(`/logistics/accept/${orderId}`, {
      method: 'POST'
    });
    return response;
  }

  // Confirmar coleta do produto
  async confirmPickup(orderId: number, pickupCode?: string): Promise<any> {
    const response = await this.request<any>(`/logistics/pickup/${orderId}`, {
      method: 'POST',
      body: JSON.stringify({ pickupCode })
    });
    return response;
  }

  // Confirmar entrega realizada
  async confirmDelivered(orderId: number): Promise<any> {
    const response = await this.request<any>(`/logistics/delivered/${orderId}`, {
      method: 'POST'
    });
    return response;
  }

  // Cancelar entrega aceita
  async cancelDelivery(orderId: number): Promise<any> {
    const response = await this.request<any>(`/logistics/cancel/${orderId}`, {
      method: 'POST'
    });
    return response;
  }

  // Minhas entregas (histórico)
  async getMyDeliveries(status?: 'active' | 'completed'): Promise<{
    deliveries: any[];
    stats: { totalDeliveries: number; totalEarnings: string };
  }> {
    const query = status ? `?status=${status}` : '';
    const response = await this.request<any>(`/logistics/my-deliveries${query}`);
    return response.data || { deliveries: [], stats: { totalDeliveries: 0, totalEarnings: '0.00' } };
  }

  // Estatísticas de entregas
  async getDeliveryStats(): Promise<{
    completedDeliveries: number;
    inProgressDeliveries: number;
    totalEarned: string;
    avgEarningPerDelivery: string;
  }> {
    const response = await this.request<any>('/logistics/stats');
    return response.data || { completedDeliveries: 0, inProgressDeliveries: 0, totalEarned: '0.00', avgEarningPerDelivery: '0.00' };
  }
}

// Exportar instância única do serviço
export const apiService = new ApiService();