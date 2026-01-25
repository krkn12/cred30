
import { ApiBase } from './api.base';

export class NotificationsApi extends ApiBase {
    async getHistory() {
        return this.get<any[]>('/notifications/');
    }

    async markAsRead(id: string) {
        return this.put('/notifications/read', { id });
    }
}
