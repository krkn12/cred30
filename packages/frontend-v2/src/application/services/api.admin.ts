import { ApiBase, ApiResponse } from './api.base';

export class AdminApi extends ApiBase {
    async getDashboard(refresh: boolean = false): Promise<ApiResponse<any>> {
        return await this.request<any>(`/admin/dashboard${refresh ? '?refresh=true' : ''}`);
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
        return await this.request<any>('/products/admin/all');
    }

    async createProduct(data: any): Promise<ApiResponse<any>> {
        return await this.post<any>('/products', data);
    }

    async updateProduct(id: string | number, data: any): Promise<ApiResponse<any>> {
        return await this.put<any>(`/products/${id}`, data);
    }

    async deleteProduct(id: string | number): Promise<ApiResponse<any>> {
        return await this.delete<any>(`/products/${id}`);
    }

    async fetchProductMetadata(url: string): Promise<any> {
        const response = await this.post<any>('/products/fetch-metadata', { url });
        return response.data || response;
    }

    async getRewardsAdmin(): Promise<ApiResponse<any>> {
        return await this.request<any>('/admin/rewards');
    }

    async saveRewardAdmin(data: any): Promise<ApiResponse<any>> {
        return await this.post<any>('/admin/rewards', data);
    }

    async addRewardInventoryAdmin(rewardId: string, codes: string): Promise<ApiResponse<any>> {
        return await this.post<any>('/admin/rewards/inventory', { rewardId, codes });
    }

    async getRewardRedemptionsAdmin(): Promise<ApiResponse<any>> {
        return await this.request<any>('/admin/rewards/redemptions');
    }

    async approveReview(id: number): Promise<ApiResponse<void>> {
        return await this.post<void>(`/admin/reviews/${id}/approve`, {});
    }

    async rejectReview(id: number): Promise<ApiResponse<void>> {
        return await this.post<void>(`/admin/reviews/${id}/reject`, {});
    }
}
