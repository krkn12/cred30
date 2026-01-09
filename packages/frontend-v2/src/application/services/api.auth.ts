import { ApiBase } from './api.base';

export interface AuthResponse {
    user: {
        id: string;
        name: string;
        email: string;
        pixKey: string;
        balance: number;
        joinedAt: number;
        referralCode: string;
        isAdmin?: boolean;
    };
    token: string;
}

export class AuthApi extends ApiBase {
    async login(email: string, password: string, secretPhrase?: string, twoFactorCode?: string): Promise<ApiResponse<AuthResponse & { requires2FA?: boolean }>> {
        const response = await this.request<AuthResponse & { requires2FA?: boolean }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, secretPhrase, twoFactorCode }),
        });

        if (response.data?.token) {
            this.token = response.data.token;
            localStorage.setItem('authToken', this.token);
        }

        return response;
    }

    async register(
        name: string,
        email: string,
        password: string,
        secretPhrase: string,
        pixKey: string,
        phone: string,
        referralCode?: string,
        cpf?: string
    ): Promise<ApiResponse<AuthResponse & { twoFactor?: { secret: string, qrCode: string, otpUri: string } }>> {
        const requestBody: any = { name, email, password, secretPhrase, pixKey, phone };
        if (referralCode && referralCode.trim() !== '') {
            requestBody.referralCode = referralCode;
        }
        if (cpf && cpf.trim() !== '') {
            requestBody.cpf = cpf.replace(/\D/g, '');
        }

        const response = await this.request<AuthResponse & { twoFactor?: { secret: string, qrCode: string, otpUri: string } }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });

        if (response.data?.token) {
            this.token = response.data.token;
            localStorage.setItem('authToken', this.token);
        }

        return response;
    }

    async loginWithGoogle(idToken: string): Promise<ApiResponse<AuthResponse & { isNewUser?: boolean }>> {
        const response = await this.request<AuthResponse & { isNewUser?: boolean }>('/auth/google', {
            method: 'POST',
            body: JSON.stringify({ idToken }),
        });

        if (response.data?.token) {
            this.token = response.data.token;
            localStorage.setItem('authToken', this.token);
        }

        return response;
    }

    async get2FASetup(): Promise<ApiResponse<any>> {
        return await this.request<any>('/auth/2fa/setup');
    }

    async verify2FA(email: string, code: string): Promise<ApiResponse<any>> {
        return await this.request<any>('/auth/verify-2fa', {
            method: 'POST',
            body: JSON.stringify({ email, code })
        });
    }

    async resetPassword(email: string, secretPhrase: string, newPassword: string): Promise<ApiResponse<void>> {
        return await this.request<void>('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email, secretPhrase, newPassword }),
        });
    }

    async recover2FA(email: string, password: string, secretPhrase: string): Promise<ApiResponse<any>> {
        return await this.request<any>('/auth/recover-2fa', {
            method: 'POST',
            body: JSON.stringify({ email, password, secretPhrase }),
        });
    }

    async logout(): Promise<ApiResponse<void>> {
        const response = await this.request<void>('/auth/logout', {
            method: 'POST',
        });

        this.token = null;
        localStorage.removeItem('authToken');
        return response;
    }
}
