import { ApiBase, ApiResponse } from './api.base';

export class UsersApi extends ApiBase {
    async getUserProfile(): Promise<any> {
        const response = await this.request<any>('/users/profile');
        return response.data;
    }

    async getUserBalance(): Promise<{ balance: number }> {
        const response = await this.request<{ balance: number }>('/users/balance');
        return response.data!;
    }

    async getUserTransactions(options?: { limit?: number, offset?: number }): Promise<ApiResponse<any>> {
        const query = new URLSearchParams();
        if (options?.limit) query.append('limit', options.limit.toString());
        if (options?.offset) query.append('offset', options.offset.toString());

        return await this.request<any>(`/users/transactions?${query.toString()}`);
    }

    async updateCpf(cpf: string): Promise<{ success: boolean; message: string }> {
        const response = await this.request<{ success: boolean; message: string }>('/users/update-cpf', {
            method: 'POST',
            body: JSON.stringify({ cpf }),
        });
        return response.data || { success: true, message: 'CPF atualizado com sucesso!' };
    }

    async updatePhone(phone: string): Promise<{ success: boolean; message: string }> {
        const response = await this.request<{ success: boolean; message: string }>('/users/update-phone', {
            method: 'POST',
            body: JSON.stringify({ phone }),
        });
        return response.data || { success: true, message: 'Telefone atualizado com sucesso!' };
    }

    async updateUserProfile(data: any): Promise<any> {
        return this.put<any>('/users/profile', data);
    }

    async changePassword(oldPassword: string, newPassword: string): Promise<any> {
        return this.post<any>('/users/change-password', { oldPassword, newPassword });
    }

    async deleteAccount(twoFactorCode?: string): Promise<any> {
        return this.delete<any>('/users/me', { twoFactorCode });
    }

    async checkTitleEligibility(): Promise<any> {
        const response = await this.request<any>('/users/title-eligibility');
        return response.data;
    }

    async downloadTitle(): Promise<any> {
        return this.post<any>('/users/title-download', {});
    }

    async getWelcomeBenefit(): Promise<any> {
        const response = await this.request<any>('/users/welcome-benefit');
        return response.data;
    }

    async claimAdReward(): Promise<any> {
        const response = await this.post<any>('/users/reward-ad', {});
        return response.data;
    }
}
