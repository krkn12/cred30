import { ApiBase } from './api.base';

export class MarketplaceApi extends ApiBase {
    // --- LISTINGS ---
    async getListings(limit: number = 50, offset: number = 0): Promise<any> {
        const response = await this.request<any>(`/marketplace/listings?limit=${limit}&offset=${offset}`);
        return response.data;
    }

    async createListing(data: any): Promise<any> {
        return this.post<any>('/marketplace/create', data);
    }

    async getMyListings(): Promise<any> {
        const response = await this.request<any>('/marketplace/my-listings');
        return response.data;
    }

    async cancelListing(listingId: number): Promise<any> {
        return this.post<any>(`/marketplace/listing/${listingId}/cancel`, {});
    }

    async boostListing(listingId: number, days: number = 7): Promise<any> {
        return this.post<any>('/marketplace/boost', { listingId, days });
    }

    // --- ORDERS & SALES ---
    async buyListing(data: any): Promise<any> {
        return this.post<any>('/marketplace/buy', data);
    }

    async buyOnCredit(data: any): Promise<any> {
        return this.post<any>('/marketplace/buy-on-credit', data);
    }

    async getMyOrders(): Promise<any> {
        const response = await this.request<any>('/marketplace/my-orders');
        return response.data;
    }

    async getMySales(): Promise<any> {
        const response = await this.request<any>('/marketplace/my-sales');
        return response.data;
    }

    async shipOrder(orderId: number, trackingCode?: string): Promise<any> {
        return this.post<any>(`/marketplace/order/${orderId}/ship`, { trackingCode });
    }

    async receiveOrder(orderId: number): Promise<any> {
        return this.post<any>(`/marketplace/order/${orderId}/receive`, {});
    }

    // --- LOGISTICS ---
    async getAvailableDeliveries(): Promise<any[]> {
        const response = await this.request<any[]>('/logistics/available');
        return response.data || [];
    }

    async acceptDelivery(orderId: number): Promise<any> {
        return this.post<any>(`/logistics/accept/${orderId}`, {});
    }

    async confirmPickup(orderId: number, pickupCode?: string): Promise<any> {
        return this.post<any>(`/logistics/pickup/${orderId}`, { pickupCode });
    }

    async confirmDelivered(orderId: number): Promise<any> {
        return this.post<any>(`/logistics/delivered/${orderId}`, {});
    }

    async getMyDeliveries(status?: string): Promise<any> {
        const query = status ? `?status=${status}` : '';
        const response = await this.request<any>(`/logistics/my-deliveries${query}`);
        return response.data;
    }

    async cancelDelivery(orderId: number): Promise<any> {
        return this.post<any>(`/logistics/cancel/${orderId}`, {});
    }

    // --- AI ---
    async getAiSuggestion(title: string): Promise<any> {
        const response = await this.request<any>('/marketplace/ai-assist', {
            method: 'POST',
            body: JSON.stringify({ title })
        });
        return response.data;
    }
}
