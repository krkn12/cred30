import { ApiBase, ApiResponse } from './api.base';

export class AdminApi extends ApiBase {
    async getDashboard(): Promise<any> {
        const response = await this.request<any>('/admin/dashboard');
        return response.data;
    }

    async getHealthMetrics(): Promise<any> {
        const response = await this.request<any>('/admin/metrics/health');
        return response.data;
    }

    async addProfitPool(amountToAdd: number): Promise<ApiResponse<void>> {
        return await this.post<void>('/admin/profit-pool', { amountToAdd });
    }

    async distributeDividends(): Promise<any> {
        const response = await this.post<any>('/admin/distribute-dividends', {});
        return response.data;
    }

    async getPayoutQueue(): Promise<any> {
        const response = await this.request<any>('/admin/payout-queue');
        return response.data;
    }

    async confirmPayout(id: string, type: string): Promise<void> {
        await this.post<void>('/admin/confirm-payout', { id, type });
    }

    async getPendingTransactions(): Promise<any> {
        const response = await this.request<any>('/admin/pending-transactions');
        return response.data;
    }

    async processAction(id: string | number, type: string, action: string): Promise<any> {
        return await this.post<any>('/admin/process-action', { id, type, action });
    }

    async getUsers(options?: any): Promise<any> {
        const query = new URLSearchParams(options);
        return await this.request<any>(`/admin/users?${query.toString()}`);
    }

    async updateUserAccess(data: any): Promise<any> {
        return await this.post<any>('/admin/users/update-access', data);
    }

    async createAttendant(data: any): Promise<any> {
        return await this.post<any>('/admin/users/create-attendant', data);
    }

    async getMarketplaceCleanupStats(): Promise<any> {
        const response = await this.request<any>('/admin/marketplace/cleanup-stats');
        return response.data;
    }

    async cleanupOldListings(daysOld: number = 7): Promise<any> {
        const response = await this.post<any>('/admin/marketplace/cleanup-old-listings', { daysOld });
        return response.data;
    }

    async getAdminReviews(): Promise<any> {
        return await this.request<any>('/admin/reviews');
    }
}
