import { Hono } from 'hono';
import { authMiddleware, adminMiddleware, attendantMiddleware } from '../middleware/auth.middleware';
import { auditMiddleware } from '../../../infrastructure/logging/audit.middleware';
import { adminRateLimit } from '../middleware/rate-limit.middleware';
import { AdminFinanceController } from '../controllers/admin.finance.controller';
import { AdminApprovalController } from '../controllers/admin.approval.controller';
import { AdminUsersController } from '../controllers/admin.users.controller';
import { AdminInvestmentsController } from '../controllers/admin.investments.controller';
import { AdminMarketplaceController } from '../controllers/admin.marketplace.controller';
import { AdminReferralController } from '../controllers/admin.referral.controller';
import { AdminRewardsController } from '../controllers/admin.rewards.controller';

const adminRoutes = new Hono();

// Aplicar middlewares a todas as rotas de admin
adminRoutes.use('*', authMiddleware);
adminRoutes.use('*', adminRateLimit);

// --- FINANCEIRO E CUSTOS ---
adminRoutes.get('/costs', adminMiddleware, AdminFinanceController.listCosts);
adminRoutes.post('/costs', adminMiddleware, auditMiddleware('ADD_COST', 'SYSTEM'), AdminFinanceController.addCost);
adminRoutes.delete('/costs/:id', adminMiddleware, auditMiddleware('DELETE_COST', 'SYSTEM'), AdminFinanceController.deleteCost);
adminRoutes.post('/costs/:id/pay', adminMiddleware, auditMiddleware('PAY_COST', 'SYSTEM'), AdminFinanceController.payCost);
adminRoutes.get('/finance-history', adminMiddleware, AdminFinanceController.getFinanceHistory);
adminRoutes.get('/dashboard', adminMiddleware, AdminFinanceController.getDashboard);
adminRoutes.get('/fiscal/report', adminMiddleware, AdminFinanceController.getFiscalReport);
adminRoutes.get('/metrics/health', attendantMiddleware, AdminFinanceController.getHealthMetrics);
adminRoutes.post('/system-balance', adminMiddleware, AdminFinanceController.systemBalanceInfo);
adminRoutes.post('/profit-pool', adminMiddleware, auditMiddleware('MANUAL_PROFIT_ADD', 'SYSTEM_CONFIG'), AdminFinanceController.addProfitPool);
adminRoutes.post('/manual-cost', adminMiddleware, auditMiddleware('ADD_MANUAL_COST', 'SYSTEM_CONFIG'), AdminFinanceController.addManualCost);
adminRoutes.post('/distribute-dividends', adminMiddleware, auditMiddleware('DISTRIBUTE_DIVIDENDS', 'SYSTEM_CONFIG'), AdminFinanceController.distributeDividends);
adminRoutes.post('/simulate-mp-payment', adminMiddleware, AdminFinanceController.simulatePayment);
adminRoutes.patch('/config', adminMiddleware, auditMiddleware('UPDATE_SYSTEM_CONFIG', 'SYSTEM_CONFIG'), AdminFinanceController.updateConfig);

// --- APROVAÇÕES E FILAS ---
adminRoutes.post('/process-action', adminMiddleware, auditMiddleware('PROCESS_ACTION', 'TRANSACTION_LOAN'), AdminApprovalController.processAction);
adminRoutes.get('/payout-queue', adminMiddleware, AdminApprovalController.getPayoutQueue);
adminRoutes.get('/pending-transactions', adminMiddleware, AdminApprovalController.getPendingTransactions);
adminRoutes.post('/confirm-payout', adminMiddleware, auditMiddleware('CONFIRM_PAYOUT', 'TRANSACTION_LOAN'), AdminApprovalController.confirmPayout);
adminRoutes.post('/fix-loan-pix', adminMiddleware, AdminApprovalController.fixLoanPix);
adminRoutes.post('/approve-payment', adminMiddleware, auditMiddleware('APPROVE_PAYMENT', 'TRANSACTION'), AdminApprovalController.approvePayment);
adminRoutes.post('/reject-payment', adminMiddleware, auditMiddleware('REJECT_PAYMENT', 'TRANSACTION'), AdminApprovalController.rejectPayment);
adminRoutes.post('/approve-withdrawal', adminMiddleware, auditMiddleware('APPROVE_WITHDRAWAL', 'TRANSACTION'), AdminApprovalController.approveWithdrawal);
adminRoutes.post('/reject-withdrawal', adminMiddleware, auditMiddleware('REJECT_WITHDRAWAL', 'TRANSACTION'), AdminApprovalController.rejectWithdrawal);
adminRoutes.post('/liquidate-loan', adminMiddleware, auditMiddleware('LIQUIDATE_LOAN_WITH_QUOTAS', 'LOAN'), AdminApprovalController.liquidateLoan);
adminRoutes.post('/run-liquidation', adminMiddleware, auditMiddleware('FORCE_LIQUIDATION', 'LOAN'), AdminApprovalController.runLiquidation);

// --- GESTÃO DE USUÁRIOS E EQUIPE ---
adminRoutes.post('/users/add-quota', adminMiddleware, auditMiddleware('MANUAL_ADD_QUOTA', 'QUOTA'), AdminUsersController.addQuota);
adminRoutes.post('/users/add-balance', adminMiddleware, auditMiddleware('MANUAL_ADD_BALANCE', 'USER'), AdminUsersController.addBalance);
adminRoutes.post('/users/reset-security-lock', adminMiddleware, auditMiddleware('RESET_SECURITY_LOCK', 'USER'), AdminUsersController.resetSecurityLock);
adminRoutes.get('/users', adminMiddleware, AdminUsersController.listUsers);
adminRoutes.post('/users/update-access', adminMiddleware, auditMiddleware('UPDATE_USER_ACCESS', 'USER'), AdminUsersController.updateUserAccess);
adminRoutes.post('/users/create-attendant', adminMiddleware, auditMiddleware('CREATE_ATTENDANT', 'USER'), AdminUsersController.createAttendant);
adminRoutes.post('/clear-admins', adminMiddleware, AdminUsersController.clearAdmins);

// --- GESTÃO DE ENTREGADORES ---
adminRoutes.get('/couriers', adminMiddleware, AdminUsersController.listPendingCouriers);
adminRoutes.post('/couriers/approve', adminMiddleware, auditMiddleware('APPROVE_COURIER', 'USER'), AdminUsersController.approveCourier);
adminRoutes.post('/couriers/reject', adminMiddleware, auditMiddleware('REJECT_COURIER', 'USER'), AdminUsersController.rejectCourier);

// --- GESTÃO DE VENDEDORES ---
adminRoutes.get('/sellers', adminMiddleware, AdminUsersController.listPendingSellers);
adminRoutes.post('/sellers/approve', adminMiddleware, auditMiddleware('APPROVE_SELLER', 'USER'), AdminUsersController.approveSeller);
adminRoutes.post('/sellers/reject', adminMiddleware, auditMiddleware('REJECT_SELLER', 'USER'), AdminUsersController.rejectSeller);



// --- GESTÃO DE CÓDIGOS DE INDICAÇÃO ---
adminRoutes.get('/referral-codes', adminMiddleware, AdminReferralController.listReferralCodes);
adminRoutes.post('/referral-codes', adminMiddleware, auditMiddleware('CREATE_REFERRAL_CODE', 'REFERRAL_CODE'), AdminReferralController.createReferralCode);
adminRoutes.post('/referral-codes/:id/toggle', adminMiddleware, auditMiddleware('TOGGLE_REFERRAL_CODE', 'REFERRAL_CODE'), AdminReferralController.toggleReferralCode);
adminRoutes.delete('/referral-codes/:id', adminMiddleware, auditMiddleware('DELETE_REFERRAL_CODE', 'REFERRAL_CODE'), AdminReferralController.deleteReferralCode);

// --- MARKETPLACE E AVALIAÇÕES ---
adminRoutes.post('/marketplace/resolve-dispute', adminMiddleware, AdminMarketplaceController.resolveDispute);
adminRoutes.get('/reviews', adminMiddleware, AdminMarketplaceController.listReviews);
adminRoutes.post('/reviews/:id/approve', adminMiddleware, AdminMarketplaceController.approveReview);
adminRoutes.post('/reviews/:id/reject', adminMiddleware, AdminMarketplaceController.rejectReview);
adminRoutes.post('/marketplace/cleanup-old-listings', adminMiddleware, auditMiddleware('CLEANUP_OLD_LISTINGS', 'MARKETPLACE'), AdminMarketplaceController.cleanupOldListings);
adminRoutes.get('/marketplace/cleanup-stats', adminMiddleware, AdminMarketplaceController.getCleanupStats);

// --- GESTÃO DE INVESTIMENTOS ---
adminRoutes.get('/investments', adminMiddleware, AdminInvestmentsController.listInvestments);
adminRoutes.post('/investments', adminMiddleware, auditMiddleware('CREATE_INVESTMENT', 'INVESTMENT'), AdminInvestmentsController.createInvestment);
adminRoutes.patch('/investments/:id', adminMiddleware, AdminInvestmentsController.updateInvestment);
adminRoutes.post('/investments/:id/dividends', adminMiddleware, auditMiddleware('RECEIVE_DIVIDEND', 'INVESTMENT'), AdminInvestmentsController.receiveDividends);
adminRoutes.post('/investments/:id/sell', adminMiddleware, auditMiddleware('SELL_INVESTMENT', 'INVESTMENT'), AdminInvestmentsController.sellInvestment);
adminRoutes.post('/investments/reserve/add', adminMiddleware, auditMiddleware('MANUAL_INVESTMENT_DEPOSIT', 'INVESTMENT'), AdminInvestmentsController.addReserve);

// --- GESTÃO DE RECOMPENSAS (GIFT CARDS) ---
adminRoutes.get('/rewards', adminMiddleware, AdminRewardsController.listRewards);
adminRoutes.post('/rewards', adminMiddleware, auditMiddleware('SAVE_REWARD', 'SYSTEM_CONFIG'), AdminRewardsController.saveReward);
adminRoutes.post('/rewards/inventory', adminMiddleware, auditMiddleware('ADD_REWARD_INVENTORY', 'SYSTEM_CONFIG'), AdminRewardsController.addInventory);
adminRoutes.get('/rewards/redemptions', adminMiddleware, AdminRewardsController.getRedemptions);

export { adminRoutes };

