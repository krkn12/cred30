import { ApiBase, ApiResponse } from './api.base';

export class UsersApi extends ApiBase {
    async getUserProfile(): Promise<ApiResponse<any>> {
        return await this.request<any>('/users/profile');
    }

    async getUserBalance(): Promise<ApiResponse<{ balance: number }>> {
        return await this.request<{ balance: number }>('/users/balance');
    }

    async getUserTransactions(options?: { limit?: number, offset?: number }): Promise<ApiResponse<any>> {
        const query = new URLSearchParams();
        if (options?.limit) query.append('limit', options.limit.toString());
        if (options?.offset) query.append('offset', options.offset.toString());

        return await this.request<any>(`/users/transactions?${query.toString()}`);
    }

    async updateCpf(cpf: string): Promise<ApiResponse<any>> {
        return await this.request<any>('/users/update-cpf', {
            method: 'POST',
            body: JSON.stringify({ cpf }),
        });
    }

    async updatePhone(phone: string): Promise<ApiResponse<any>> {
        return await this.request<any>('/users/update-phone', {
            method: 'POST',
            body: JSON.stringify({ phone }),
        });
    }

    async updatePixKey(pixKey: string): Promise<ApiResponse<any>> {
        return await this.request<any>('/users/update-pix-key', {
            method: 'POST',
            body: JSON.stringify({ pixKey }),
        });
    }

    async updateUserProfile(data: any): Promise<ApiResponse<any>> {
        return await this.put<any>('/users/profile', data);
    }

    async changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse<any>> {
        return await this.post<any>('/users/change-password', { oldPassword, newPassword });
    }

    async deleteAccount(twoFactorCode?: string): Promise<ApiResponse<any>> {
        return await this.delete<any>('/users/me', { twoFactorCode });
    }

    async checkTitleEligibility(): Promise<ApiResponse<any>> {
        return await this.request<any>('/users/title-eligibility');
    }

    async downloadTitle(): Promise<ApiResponse<any>> {
        return await this.post<any>('/users/title-download', {});
    }

    async getWelcomeBenefit(): Promise<ApiResponse<any>> {
        return await this.request<any>('/users/welcome-benefit');
    }

    async claimAdReward(): Promise<ApiResponse<any>> {
        return await this.post<any>('/users/reward-ad', {});
    }
}
