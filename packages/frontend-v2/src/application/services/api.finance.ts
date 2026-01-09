import { ApiBase, ApiResponse } from './api.base';

export class FinanceApi extends ApiBase {
    // --- QUOTAS ---
    async getQuotas(): Promise<ApiResponse<any>> {
        return await this.request<any>('/quotas');
    }

    async buyQuotas(quantity: number, useBalance: boolean, paymentMethod?: string): Promise<ApiResponse<any>> {
        return await this.post<any>('/quotas/buy', { quantity, useBalance, paymentMethod });
    }

    async sellQuota(quotaId: string): Promise<ApiResponse<any>> {
        return await this.post<any>('/quotas/sell', { quotaId });
    }

    async sellAllQuotas(): Promise<ApiResponse<any>> {
        return await this.post<any>('/quotas/sell-all', {});
    }

    // --- LOANS ---
    async getLoans(): Promise<ApiResponse<any>> {
        return await this.request<any>('/loans');
    }

    async requestLoan(amount: number, installments: number, guaranteePercentage: number = 100): Promise<ApiResponse<any>> {
        return await this.post<any>('/loans/request', { amount, installments, guaranteePercentage });
    }

    async repayLoan(loanId: string, useBalance: boolean, paymentMethod?: string): Promise<ApiResponse<any>> {
        return await this.post<any>('/loans/repay', { loanId, useBalance, paymentMethod });
    }

    async repayInstallment(loanId: string, amount: number, useBalance: boolean, paymentMethod?: string): Promise<ApiResponse<any>> {
        return await this.post<any>('/loans/repay-installment', {
            loanId,
            installmentAmount: amount,
            useBalance,
            paymentMethod
        });
    }

    async getAvailableLimit(): Promise<ApiResponse<any>> {
        return await this.request<any>('/loans/available-limit');
    }

    // --- WITHDRAWALS ---
    async requestWithdrawal(amount: number, pixKey: string): Promise<ApiResponse<any>> {
        return await this.post<any>('/withdrawals/request', { amount, pixKey });
    }

    async confirmWithdrawal(transactionId: number, code: string, password: string): Promise<ApiResponse<any>> {
        return await this.post<any>('/withdrawals/confirm', { transactionId, code, password });
    }

    // --- DEPOSITS ---
    async requestDeposit(amount: number): Promise<ApiResponse<any>> {
        return await this.post<any>('/transactions/deposit', { amount });
    }

    async submitReview(transactionId: number, rating: number, comment: string, isPublic: boolean): Promise<ApiResponse<any>> {
        return await this.post<any>('/transactions/review', { transactionId, rating, comment, isPublic });
    }
}
