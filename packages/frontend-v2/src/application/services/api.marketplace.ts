import { ApiBase } from './api.base';

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
    async getAvailableDeliveries(): Promise<ApiResponse<any>> {
        return await this.request<any>('/logistics/available');
    }

    async acceptDelivery(orderId: number): Promise<ApiResponse<any>> {
        return await this.post<any>(`/logistics/accept/${orderId}`, {});
    }

    async confirmPickup(orderId: number, pickupCode?: string): Promise<ApiResponse<any>> {
        return await this.post<any>(`/logistics/pickup/${orderId}`, { pickupCode });
    }

    async confirmDelivered(orderId: number): Promise<ApiResponse<any>> {
        return await this.post<any>(`/logistics/delivered/${orderId}`, {});
    }

    async getMyDeliveries(status?: string): Promise<ApiResponse<any>> {
        const query = status ? `?status=${status}` : '';
        return await this.request<any>(`/logistics/my-deliveries${query}`);
    }

    async cancelDelivery(orderId: number): Promise<ApiResponse<any>> {
        return await this.post<any>(`/logistics/cancel/${orderId}`, {});
    }

    // --- AI ---
    async getAiSuggestion(title: string): Promise<ApiResponse<any>> {
        return await this.request<any>('/marketplace/ai-assist', {
            method: 'POST',
            body: JSON.stringify({ title })
        });
    }
}
