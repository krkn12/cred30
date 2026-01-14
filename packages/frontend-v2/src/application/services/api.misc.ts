import { ApiBase } from './api.base';

export class MiscApi extends ApiBase {
    // --- PROMO VIDEOS ---
    async getPromoTags(): Promise<string[]> {
        const response = await this.request<any>('/promo-videos/tags');
        return response.data || [];
    }

    async getPromoFeed(tag?: string): Promise<any[]> {
        const url = tag ? `/promo-videos/feed?tag=${tag}` : '/promo-videos/feed';
        const response = await this.request<any>(url);
        return response.data || [];
    }

    async startPromoView(videoId: number): Promise<any> {
        return this.post<any>(`/promo-videos/${videoId}/start-view`, {});
    }

    async completePromoView(videoId: number, watchTimeSeconds: number): Promise<any> {
        return this.post<any>(`/promo-videos/${videoId}/complete-view`, { watchTimeSeconds });
    }

    // --- PRODUCTS ---
    async getProducts(category?: string): Promise<any[]> {
        const params = category ? `?category=${category}` : '';
        const response = await this.request<any[]>('/products' + params);
        return response.data || [];
    }

    // --- BUG REPORTS ---
    async createBugReport(data: any): Promise<any> {
        return this.post<any>('/bugs', data);
    }

    async getMyBugReports(): Promise<any> {
        const response = await this.request<any>('/bugs/my');
        return response.data;
    }

    // --- VOTING ---
    async getProposals(): Promise<any> {
        return await this.request<any>('/voting/proposals');
    }

    async vote(proposalId: number, optionId: number): Promise<any> {
        return await this.post<any>(`/voting/proposal/${proposalId}/vote`, { optionId });
    }

    async createProposal(title: string, description: string): Promise<any> {
        return await this.post<any>('/voting/proposals', { title, description });
    }

    async closeProposal(id: number): Promise<any> {
        return await this.post<any>(`/voting/proposals/${id}/close`, {});
    }

    // --- MONETIZATION ---
    async dailyCheckin(): Promise<any> {
        return this.post<any>('/monetization/daily-checkin', {});
    }
}
