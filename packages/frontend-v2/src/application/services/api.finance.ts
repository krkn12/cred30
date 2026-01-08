import { ApiBase, ApiResponse } from './api.base';

export class FinanceApi extends ApiBase {
    // --- QUOTAS ---
    async getQuotas(): Promise<any> {
        const response = await this.request<any>('/quotas');
        return response.data;
    }

    async buyQuotas(quantity: number, useBalance: boolean, paymentMethod?: string): Promise<any> {
        const response = await this.post<any>('/quotas/buy', { quantity, useBalance, paymentMethod });
        return response.data;
    }

    async sellQuota(quotaId: string): Promise<any> {
        const response = await this.post<any>('/quotas/sell', { quotaId });
        return response.data;
    }

    async sellAllQuotas(): Promise<any> {
        const response = await this.post<any>('/quotas/sell-all', {});
        return response.data;
    }

    // --- LOANS ---
    async getLoans(): Promise<any> {
        const response = await this.request<any>('/loans');
        return response.data;
    }

    async requestLoan(amount: number, installments: number, guaranteePercentage: number = 100): Promise<any> {
        const response = await this.post<any>('/loans/request', { amount, installments, guaranteePercentage });
        return response.data;
    }

    async repayLoan(loanId: string, useBalance: boolean, paymentMethod?: string): Promise<any> {
        const response = await this.post<any>('/loans/repay', { loanId, useBalance, paymentMethod });
        return response.data;
    }

    async repayInstallment(loanId: string, amount: number, useBalance: boolean, paymentMethod?: string): Promise<any> {
        const response = await this.post<any>('/loans/repay-installment', {
            loanId,
            installmentAmount: amount,
            useBalance,
            paymentMethod
        });
        return response.data;
    }

    async getAvailableLimit(): Promise<any> {
        const response = await this.request<any>('/loans/available-limit');
        return response.data;
    }

    // --- WITHDRAWALS ---
    async requestWithdrawal(amount: number, pixKey: string): Promise<ApiResponse<any>> {
        return await this.post<any>('/withdrawals/request', { amount, pixKey });
    }

    async confirmWithdrawal(transactionId: number, code: string, password: string): Promise<any> {
        return this.post<any>('/withdrawals/confirm', { transactionId, code, password });
    }

    // --- DEPOSITS ---
    async requestDeposit(amount: number): Promise<any> {
        const response = await this.post<any>('/transactions/deposit', { amount });
        return response.data;
    }
}
