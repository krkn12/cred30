import { ApiBase, ApiResponse } from './api.base';

export interface UserProfileUpdatePayload {
    password?: string;
    confirmationCode?: string;
    pixKey?: string;
    panicPhrase?: string;
    secretPhrase?: string;
    safeContactPhone?: string;
}

export class UsersApi extends ApiBase {
    async getUserProfile(): Promise<ApiResponse<unknown>> {
        return await this.request<unknown>('/users/profile');
    }

    async getUserBalance(): Promise<ApiResponse<{ balance: number }>> {
        return await this.request<{ balance: number }>('/users/balance');
    }

    async getUserTransactions(options?: { limit?: number, offset?: number }): Promise<ApiResponse<unknown>> {
        const query = new URLSearchParams();
        if (options?.limit) query.append('limit', options.limit.toString());
        if (options?.offset) query.append('offset', options.offset.toString());

        return await this.request<unknown>(`/users/transactions?${query.toString()}`);
    }

    async updateCpf(cpf: string): Promise<ApiResponse<unknown>> {
        return await this.request<unknown>('/users/update-cpf', {
            method: 'POST',
            body: JSON.stringify({ cpf }),
        });
    }

    async updatePhone(phone: string): Promise<ApiResponse<unknown>> {
        return await this.request<unknown>('/users/update-phone', {
            method: 'POST',
            body: JSON.stringify({ phone }),
        });
    }

    async updatePixKey(pixKey: string): Promise<ApiResponse<unknown>> {
        return await this.request<unknown>('/users/update-pix-key', {
            method: 'POST',
            body: JSON.stringify({ pixKey }),
        });
    }

    async updateUserProfile(data: UserProfileUpdatePayload): Promise<ApiResponse<unknown>> {
        return await this.put<unknown>('/users/profile', data);
    }

    async changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse<unknown>> {
        return await this.post<unknown>('/users/change-password', { oldPassword, newPassword });
    }

    async deleteAccount(twoFactorCode?: string): Promise<ApiResponse<unknown>> {
        return await this.delete<unknown>('/users/me', { twoFactorCode });
    }

    async checkTitleEligibility(): Promise<ApiResponse<unknown>> {
        return await this.request<unknown>('/users/title-eligibility');
    }

    async downloadTitle(): Promise<ApiResponse<unknown>> {
        return await this.post<unknown>('/users/title-download', {});
    }

    async getWelcomeBenefit(): Promise<ApiResponse<unknown>> {
        return await this.request<unknown>('/users/welcome-benefit');
    }

    async claimAdReward(): Promise<ApiResponse<unknown>> {
        return await this.post<unknown>('/users/reward-ad', {});
    }

    async linkReferrer(referralCode: string): Promise<ApiResponse<unknown>> {
        return await this.post<unknown>('/users/link-referrer', { referralCode });
    }
}
