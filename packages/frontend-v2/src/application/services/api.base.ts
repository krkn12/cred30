// URL base da API - detecta se está acessando via ngrok
const getApiBaseUrl = () => {
    const currentUrl = window.location.origin;
    if (currentUrl.includes('ngrok-free.app')) {
        return currentUrl + '/api';
    }
    return (import.meta as any).env.VITE_API_URL || '/api';
};

export const API_BASE_URL = getApiBaseUrl();

export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data?: T;
    errors?: any[];
    pagination?: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
    [key: string]: any;
}

export class ApiBase {
    // Shared source of truth via localStorage
    protected get token(): string | null {
        const stored = localStorage.getItem('authToken');
        return (stored && stored !== 'null' && stored !== 'undefined') ? stored : null;
    }

    protected set token(value: string | null) {
        if (value) {
            localStorage.setItem('authToken', value);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    constructor() { }

    public isAuthenticated(): boolean {
        return !!this.token;
    }

    protected getHeaders() {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    protected async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const url = `${API_BASE_URL}${endpoint}`;

        // Timeout de 15 segundos para evitar loading infinito
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const config: RequestInit = {
            headers: this.getHeaders(),
            signal: controller.signal,
            ...options,
        };

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            let data;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                try {
                    data = JSON.parse(text);
                } catch {
                    data = { message: text || 'Erro na requisição' };
                }
            }

            if (!response.ok) {
                if (response.status === 401 || (response.status === 404 && (endpoint === '/users/profile' || endpoint === '/users/balance'))) {
                    this.token = null;
                    localStorage.removeItem('authToken');
                    window.dispatchEvent(new CustomEvent('auth-expired'));
                }
                const error: any = new Error(data.message || 'Erro na requisição');
                Object.assign(error, data);
                throw error;
            }

            return data;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                error.message = 'O servidor demorou muito para responder. Verifique sua conexão.';
            }

            if (error.name === 'TypeError' && !navigator.onLine) {
                error.message = 'Sua conexão com a internet caiu. O App exibirá dados salvos quando possível.';
            }

            // Silence 401/Token errors (handled by logout logic)
            const isAuthError = error.status === 401 || error.message?.includes('Token');
            if (!isAuthError) {
                console.error('Erro na requisição:', error);
            }
            throw error;
        }
    }

    public async get<T>(endpoint: string): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { method: 'GET' });
    }

    public async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    public async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    }

    public async delete<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'DELETE',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    public async patch<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
    }
}
