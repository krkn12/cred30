// URL base da API - detecta se está acessando via ngrok ou local
const getApiBaseUrl = () => {
    const currentUrl = window.location.origin;

    // Se for ngrok, assume o mesmo domínio com /api
    if (currentUrl.includes('ngrok-free.app')) {
        return currentUrl + '/api';
    }

    // Prioridade 1: Variável de ambiente (se definida e começar com http ou /)
    const envUrl = (import.meta as any).env.VITE_API_URL;
    if (envUrl) {
        // Se a envUrl for apenas "/api", ela é relativa ao domínio atual
        // Em desenvolvimento, isso pode falhar se o backend estiver em outra porta (3001)
        if (envUrl === '/api' && (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1'))) {
            const devUrl = 'http://localhost:3001/api';
            console.log(`[ApiService] Dev Mode detectado. Usando: ${devUrl}`);
            return devUrl;
        }
        console.log(`[ApiService] Usando VITE_API_URL: ${envUrl}`);
        return envUrl;
    }

    // Fallback: Backend oficial no Render
    const fallback = 'https://cred30-backend.onrender.com/api';
    console.warn(`[ApiService] Nenhuma variável definida. Fallback para: ${fallback}`);
    return fallback;
};

export const API_BASE_URL = getApiBaseUrl();
console.log(`[ApiService] Inicializado com BASE_URL: ${API_BASE_URL}`);

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
        console.log(`[API REQUEST] ${options.method || 'GET'} ${url}`);

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

            console.log(`[API RESPONSE] ${endpoint} ->`, data);
            return data;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error('O servidor demorou muito para responder. Verifique sua conexão e tente novamente.');
            }

            if (error.name === 'TypeError' && !navigator.onLine) {
                throw new Error('Sua conexão com a internet caiu. Verifique seu sinal.');
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

    private safeJsonStringify(obj: any): string {
        const cache = new Set();
        return JSON.stringify(obj, (_key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (cache.has(value)) {
                    // Circular reference found, discard key
                    return;
                }
                cache.add(value);
            }
            return value;
        });
    }

    public async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: this.safeJsonStringify(body),
        });
    }

    public async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: this.safeJsonStringify(body),
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
