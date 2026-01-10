import { ApiBase } from './api.base';
import { AuthApi } from './api.auth';
import { UsersApi } from './api.users';
import { MarketplaceApi } from './api.marketplace';
import { FinanceApi } from './api.finance';
import { AdminApi } from './api.admin';
import { MiscApi } from './api.misc';

/**
 * ApiService reorganizado em múltiplos sub-serviços.
 * Esta classe atua como uma fachada (Facade) para manter compatibilidade com o código existente.
 */
class ApiService extends ApiBase {
  public auth = new AuthApi();
  public users = new UsersApi();
  public marketplace = new MarketplaceApi();
  public finance = new FinanceApi();
  public admin = new AdminApi();
  public misc = new MiscApi();

  constructor() {
    super();
  }

  // Redirecionamento de métodos legados para os novos sub-serviços
  // Auth
  login = this.auth.login.bind(this.auth);
  register = this.auth.register.bind(this.auth);
  logout = this.auth.logout.bind(this.auth);
  loginWithGoogle = this.auth.loginWithGoogle.bind(this.auth);
  verify2FA = this.auth.verify2FA.bind(this.auth);
  get2FASetup = this.auth.get2FASetup.bind(this.auth);

  // Users
  getUserProfile = this.users.getUserProfile.bind(this.users);
  getUserBalance = this.users.getUserBalance.bind(this.users);
  getUserTransactions = this.users.getUserTransactions.bind(this.users);
  updateUserProfile = this.users.updateUserProfile.bind(this.users);
  deleteAccount = this.users.deleteAccount.bind(this.users);
  updateCpf = this.users.updateCpf.bind(this.users);
  updatePhone = this.users.updatePhone.bind(this.users);
  updatePixKey = this.users.updatePixKey.bind(this.users);

  // Finance
  getUserQuotas = this.finance.getQuotas.bind(this.finance);
  buyQuotas = this.finance.buyQuotas.bind(this.finance);
  getUserLoans = this.finance.getLoans.bind(this.finance);
  requestLoan = this.finance.requestLoan.bind(this.finance);
  repayLoan = this.finance.repayLoan.bind(this.finance);
  requestWithdrawal = this.finance.requestWithdrawal.bind(this.finance);
  confirmWithdrawal = this.finance.confirmWithdrawal.bind(this.finance);
  requestDeposit = this.finance.requestDeposit.bind(this.finance);
  submitReview = this.finance.submitReview.bind(this.finance);
  getAvailableLimit = this.finance.getAvailableLimit.bind(this.finance);

  // Marketplace
  getMarketplaceListings = this.marketplace.getListings.bind(this.marketplace);
  createMarketplaceListing = this.marketplace.createListing.bind(this.marketplace);
  buyMarketplaceListing = this.marketplace.buyListing.bind(this.marketplace);
  getMyMarketplaceOrders = this.marketplace.getMyOrders.bind(this.marketplace);

  // Admin
  getAdminDashboard = this.admin.getDashboard.bind(this.admin);
  addProfitToPool = this.admin.addProfitPool.bind(this.admin);
  distributeDividends = this.admin.distributeDividends.bind(this.admin);
  getPendingTransactions = this.admin.getPendingTransactions.bind(this.admin);
  getPayoutQueue = this.admin.getPayoutQueue.bind(this.admin);
  getAdminReviews = this.admin.getAdminReviews.bind(this.admin);
  getHealthMetrics = this.admin.getHealthMetrics.bind(this.admin);
  getAllProductsAdmin = this.admin.getAllProductsAdmin.bind(this.admin);
  getUsers = this.admin.getUsers.bind(this.admin);
  updateUserAccess = this.admin.updateUserAccess.bind(this.admin);
  createAttendant = this.admin.createAttendant.bind(this.admin);
  confirmPayout = this.admin.confirmPayout.bind(this.admin);
  processAction = this.admin.processAction.bind(this.admin);
  getMarketplaceCleanupStats = this.admin.getMarketplaceCleanupStats.bind(this.admin);
  cleanupOldListings = this.admin.cleanupOldListings.bind(this.admin);


  // Aliases required by AdminUserManagement.tsx
  adminGetUsers = this.admin.getUsers.bind(this.admin);
  adminUpdateUserAccess = this.admin.updateUserAccess.bind(this.admin);
  adminCreateAttendant = this.admin.createAttendant.bind(this.admin);

  // Auth & Account
  resetPassword = this.auth.resetPassword.bind(this.auth);
  changePassword = this.users.changePassword.bind(this.users);

  // Quotas & Finance
  sellQuota = this.finance.sellQuota.bind(this.finance);
  sellAllQuotas = this.finance.sellAllQuotas.bind(this.finance);
  repayInstallment = this.finance.repayInstallment.bind(this.finance);

  // Misc
  claimAdReward = this.users.claimAdReward.bind(this.users);

  // Logistics
  getAvailableDeliveries = this.marketplace.getAvailableDeliveries.bind(this.marketplace);
  acceptDelivery = this.marketplace.acceptDelivery.bind(this.marketplace);
  confirmPickup = this.marketplace.confirmPickup.bind(this.marketplace);
  confirmDelivered = this.marketplace.confirmDelivered.bind(this.marketplace);
  getMyDeliveries = this.marketplace.getMyDeliveries.bind(this.marketplace);
  cancelDelivery = this.marketplace.cancelDelivery.bind(this.marketplace);

  // Voting
  getProposals = this.misc.getProposals.bind(this.misc);
  vote = this.misc.vote.bind(this.misc);

  getDeliveryStats = async () => {
    return await this.get<any>('/logistics/stats');
  };

  // Premium Features
  buyVerifiedBadge = async () => {
    return await this.post<any>('/monetization/buy-verified-badge', {});
  };

  buyScoreBoost = async () => {
    return await this.post<any>('/monetization/buy-score-boost', {});
  };

  // Notificações em Tempo Real via SSE (Server-Sent Events)
  listenToNotifications(callback: (notification: any) => void): () => void {
    // Verifica se está autenticado
    if (!this.isAuthenticated()) {
      console.warn('[Notifications] Usuário não autenticado, ignorando SSE.');
      return () => { };
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      return () => { };
    }

    // Monta a URL do SSE com o token (usa mesma base que outras requisições)
    const baseUrl = (import.meta as any).env.VITE_API_URL || 'https://cred30-backend.onrender.com';
    // Remove trailing /api se existir, pois vamos adicionar o path completo
    const cleanBaseUrl = baseUrl.replace(/\/api\/?$/, '');
    const sseUrl = `${cleanBaseUrl}/api/notifications/stream`;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let isClosing = false;

    const connect = () => {
      if (isClosing) return;

      try {
        // EventSource não suporta headers customizados nativamente.
        // Usamos query param para auth (alternativa comum para SSE)
        eventSource = new EventSource(`${sseUrl}?token=${token}`);

        eventSource.onopen = () => {
          console.log('[Notifications] Conectado ao stream de notificações ✅');
        };

        eventSource.onmessage = (event) => {
          try {
            if (event.data && event.data !== 'ping') {
              const notification = JSON.parse(event.data);
              callback(notification);
            }
          } catch (e) {
            // Ignora erros de parse (pode ser ping)
          }
        };

        eventSource.addEventListener('notification', (event: any) => {
          try {
            const notification = JSON.parse(event.data);
            callback(notification);
          } catch (e) {
            console.error('[Notifications] Erro ao processar notificação:', e);
          }
        });

        eventSource.onerror = (error) => {
          console.warn('[Notifications] Conexão SSE perdida, tentando reconectar...', error);
          eventSource?.close();

          // Tenta reconectar após 5 segundos
          if (!isClosing) {
            reconnectTimeout = setTimeout(connect, 5000);
          }
        };

      } catch (error) {
        console.error('[Notifications] Erro ao conectar SSE:', error);
        // Tenta reconectar após 10 segundos
        if (!isClosing) {
          reconnectTimeout = setTimeout(connect, 10000);
        }
      }
    };

    // Inicia a conexão
    connect();

    // Retorna função de cleanup
    return () => {
      isClosing = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (eventSource) {
        eventSource.close();
        console.log('[Notifications] Desconectado do stream de notificações');
      }
    };
  }

  // Utilitários de Auth propagados do ApiBase via qualquer sub-serviço (eles compartilham a mesma lógica)
  isAuthenticated() {
    return this.auth.isAuthenticated();
  }
}

// Para evitar quebrar o código que usa apiService.method()
export const apiService = new ApiService();