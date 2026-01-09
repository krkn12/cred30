import { ApiBase, ApiResponse } from './api.base';

export class AdminApi extends ApiBase {
    async getDashboard(): Promise<ApiResponse<any>> {
        return await this.request<any>('/admin/dashboard');
    }

    async getHealthMetrics(): Promise<ApiResponse<any>> {
        return await this.request<any>('/admin/metrics/health');
    }

    async addProfitPool(amountToAdd: number): Promise<ApiResponse<void>> {
        return await this.post<void>('/admin/profit-pool', { amountToAdd });
    }

    async distributeDividends(): Promise<ApiResponse<any>> {
        return await this.post<any>('/admin/distribute-dividends', {});
    }

    async getPayoutQueue(): Promise<ApiResponse<any>> {
        return await this.request<any>('/admin/payout-queue');
    }

    async confirmPayout(id: string, type: string): Promise<ApiResponse<void>> {
        return await this.post<void>('/admin/confirm-payout', { id, type });
    }

    async getPendingTransactions(): Promise<ApiResponse<any>> {
        return await this.request<any>('/admin/pending-transactions');
    }

    async processAction(id: string | number, type: string, action: string): Promise<ApiResponse<any>> {
        return await this.post<any>('/admin/process-action', { id, type, action });
    }

    async getUsers(options?: any): Promise<ApiResponse<any>> {
        const query = new URLSearchParams(options);
        return await this.request<any>(`/admin/users?${query.toString()}`);
    }

    async updateUserAccess(data: any): Promise<ApiResponse<any>> {
        return await this.post<any>('/admin/users/update-access', data);
    }

    async createAttendant(data: any): Promise<ApiResponse<any>> {
        return await this.post<any>('/admin/users/create-attendant', data);
    }

    async getMarketplaceCleanupStats(): Promise<ApiResponse<any>> {
        return await this.request<any>('/admin/marketplace/cleanup-stats');
    }

    async cleanupOldListings(daysOld: number = 7): Promise<ApiResponse<any>> {
        return await this.post<any>('/admin/marketplace/cleanup-old-listings', { daysOld });
    }

    async getAdminReviews(): Promise<any> {
        return await this.request<any>('/admin/reviews');
    }

    async getAllProductsAdmin(): Promise<any> {
        return await this.request<any>('/admin/products');
    }
}
