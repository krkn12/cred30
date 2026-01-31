import { ApiBase, ApiResponse } from './api.base';

export class MarketplaceApi extends ApiBase {
    // --- LISTINGS ---
    async getListings(limit: number = 50, offset: number = 0): Promise<ApiResponse<any>> {
        return await this.request<any>(`/marketplace/listings?limit=${limit}&offset=${offset}`);
    }

    async createListing(data: any): Promise<ApiResponse<any>> {
        return await this.post<any>('/marketplace/create', data);
    }

    async getMyListings(): Promise<ApiResponse<any>> {
        return await this.request<any>('/marketplace/my-listings');
    }

    async getListingDetails(id: string | number): Promise<ApiResponse<any>> {
        return await this.request<any>(`/marketplace/listings/${id}`);
    }

    async cancelListing(listingId: number): Promise<ApiResponse<any>> {
        return await this.post<any>(`/marketplace/listing/${listingId}/cancel`, {});
    }

    async boostListing(listingId: number, days: number = 7): Promise<ApiResponse<any>> {
        return await this.post<any>('/marketplace/boost', { listingId, days });
    }

    // --- ORDERS & SALES ---
    async buyListing(data: any): Promise<ApiResponse<any>> {
        return await this.post<any>('/marketplace/buy', data);
    }

    async buyOnCredit(data: any): Promise<ApiResponse<any>> {
        return await this.post<any>('/marketplace/buy-on-credit', data);
    }

    async getMyOrders(): Promise<ApiResponse<any>> {
        return await this.request<any>('/marketplace/my-orders');
    }

    async getMySales(): Promise<ApiResponse<any>> {
        return await this.request<any>('/marketplace/my-sales');
    }

    async shipOrder(orderId: number, trackingCode?: string): Promise<ApiResponse<any>> {
        return await this.post<any>(`/marketplace/order/${orderId}/ship`, { trackingCode });
    }

    async receiveOrder(orderId: number): Promise<ApiResponse<any>> {
        return await this.post<any>(`/marketplace/order/${orderId}/receive`, {});
    }

    // --- LOGISTICS ---
    async getAvailableDeliveries(lat?: number, lng?: number): Promise<ApiResponse<any>> {
        const query = (lat && lng) ? `?lat=${lat}&lng=${lng}` : '';
        return await this.request<any>(`/marketplace/logistic/missions${query}`);
    }

    async acceptDelivery(orderId: number): Promise<ApiResponse<any>> {
        return await this.post<any>(`/marketplace/logistic/mission/${orderId}/accept`, {});
    }

    async confirmPickup(orderId: number, pickupCode?: string): Promise<ApiResponse<any>> {
        return await this.post<any>(`/marketplace/logistic/mission/${orderId}/pickup`, { pickupCode });
    }

    async confirmDelivered(orderId: number): Promise<ApiResponse<any>> {
        return await this.post<any>(`/marketplace/logistic/mission/${orderId}/delivered`, {});
    }

    async getMyDeliveries(status?: string): Promise<ApiResponse<any>> {
        const query = status ? `?status=${status}` : '';
        return await this.request<any>(`/logistics/my-deliveries${query}`);
    }

    async cancelDelivery(orderId: number): Promise<ApiResponse<any>> {
        return await this.post<any>(`/logistics/cancel/${orderId}`, {});
    }

    async getShippingQuote(listingId: number | string, cep: string): Promise<ApiResponse<any>> {
        return await this.request<any>(`/marketplace/logistic/quote?listingId=${listingId}&destCep=${cep}`);
    }

    // --- AI ---
    async getAiSuggestion(title: string): Promise<ApiResponse<any>> {
        return await this.request<any>('/marketplace/ai-assist', {
            method: 'POST',
            body: JSON.stringify({ title })
        });
    }

    // --- COURIER REGISTRATION ---
    async getCourierStatus(): Promise<any> {
        const res = await this.request<any>('/logistics/status');
        return res.data || res;
    }

    async registerCourier(data: { cpf: string; phone: string; city: string; state: string; vehicle: string }): Promise<ApiResponse<any>> {
        return await this.post<any>('/logistics/register', data);
    }

    async getDeliveryStats(): Promise<ApiResponse<any>> {
        return await this.request<any>('/logistics/stats');
    }

    // --- FAVORITOS ---
    async toggleFavorite(listingId: number): Promise<ApiResponse<any>> {
        return await this.post<any>(`/marketplace/listing/${listingId}/favorite`, {});
    }

    async getMyFavorites(): Promise<ApiResponse<any>> {
        return await this.request<any>('/marketplace/favorites');
    }

    // --- PERGUNTAS ---
    async askQuestion(listingId: number, question: string): Promise<ApiResponse<any>> {
        return await this.post<any>(`/marketplace/listing/${listingId}/question`, { question });
    }

    async getQuestions(listingId: number): Promise<ApiResponse<any>> {
        return await this.request<any>(`/marketplace/listing/${listingId}/questions`);
    }

    async answerQuestion(questionId: number, answer: string): Promise<ApiResponse<any>> {
        return await this.post<any>(`/marketplace/question/${questionId}/answer`, { answer });
    }

    // --- AVALIAÇÕES ---
    async reviewOrder(orderId: number, rating: number, comment?: string): Promise<ApiResponse<any>> {
        return await this.post<any>(`/marketplace/order/${orderId}/review`, { rating, comment });
    }

    async getSellerReviews(sellerId: string): Promise<ApiResponse<any>> {
        return await this.request<any>(`/marketplace/seller/${sellerId}/reviews`);
    }

    async getSellerProfile(sellerId: string): Promise<ApiResponse<any>> {
        return await this.request<any>(`/marketplace/seller/${sellerId}/profile`);
    }

    // --- SELLER REGISTRATION ---
    async getSellerStatus(): Promise<any> {
        const res = await this.request<any>('/seller/status');
        return res.data || res; // Adaptação pois o backend pode retornar direto ou wrapado
    }

    async registerSeller(data: any): Promise<ApiResponse<any>> {
        return await this.post<any>('/seller/register', data);
    }

    // --- FOOD DELIVERY ---
    async getFoodCategories(): Promise<ApiResponse<any>> {
        return await this.request<any>('/marketplace/delivery/categories');
    }

    async getVenues(category?: string, city?: string, state?: string): Promise<ApiResponse<any>> {
        let query = '';
        if (category || city || state) {
            const params = new URLSearchParams();
            if (category) params.append('category', category);
            if (city) params.append('city', city);
            if (state) params.append('state', state);
            query = `?${params.toString()}`;
        }
        return await this.request<any>(`/marketplace/delivery/venues${query}`);
    }

    async updateFoodOrderStatus(orderId: number, status: 'PREPARING' | 'READY_FOR_PICKUP'): Promise<ApiResponse<any>> {
        return await this.post<any>(`/marketplace/order/${orderId}/food-status`, { status });
    }

    async updateStoreProfile(data: { merchantName: string, category: string, openingHours: any }): Promise<ApiResponse<any>> {
        return await this.post<any>('/marketplace/delivery/profile', data);
    }

    async toggleStorePause(isPaused: boolean): Promise<ApiResponse<any>> {
        return await this.post<any>('/marketplace/delivery/pause', { isPaused });
    }

    async updateMissionLocation(orderId: number, lat: number, lng: number): Promise<ApiResponse<any>> {
        return await this.post<any>(`/logistics/location/${orderId}`, { lat, lng });
    }

    // --- TERMOS DE USO ---
    async getSellerTermsText(): Promise<ApiResponse<any>> {
        return await this.request<any>('/terms/seller/text');
    }

    async getCourierTermsText(): Promise<ApiResponse<any>> {
        return await this.request<any>('/terms/courier/text');
    }

    async getTermsStatus(): Promise<ApiResponse<any>> {
        return await this.request<any>('/terms/status');
    }

    async acceptSellerTerms(): Promise<ApiResponse<any>> {
        return await this.post<any>('/terms/seller/accept', {});
    }

    async acceptCourierTerms(): Promise<ApiResponse<any>> {
        return await this.post<any>('/terms/courier/accept', {});
    }

    // --- CLAIMS / INCIDENTES ---
    async createClaim(orderId: number, claimType: string, description: string, evidenceUrls?: string[]): Promise<ApiResponse<any>> {
        return await this.post<any>('/claims/create', { orderId, claimType, description, evidenceUrls });
    }

    async listClaims(status: string = 'PENDING'): Promise<ApiResponse<any>> {
        return await this.request<any>(`/claims/list?status=${status}`);
    }

    async getClaimDetails(claimId: number): Promise<ApiResponse<any>> {
        return await this.request<any>(`/claims/${claimId}`);
    }

    async resolveClaim(claimId: number, data: { status: 'APPROVED' | 'REJECTED', sellerRefund?: number, buyerRefund?: number, courierPenalty?: number, adminNotes?: string }): Promise<ApiResponse<any>> {
        return await this.post<any>(`/claims/${claimId}/resolve`, data);
    }
}

export const apiMarketplace = new MarketplaceApi();
