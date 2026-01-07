import { apiService } from './api.service';

interface QueuedAction {
    id: string;
    type: string;
    payload: any;
    timestamp: number;
}

class SyncService {
    private queueKey = 'offline_actions_queue';

    private getQueue(): QueuedAction[] {
        const queue = localStorage.getItem(this.queueKey);
        return queue ? JSON.parse(queue) : [];
    }

    private saveQueue(queue: QueuedAction[]) {
        localStorage.setItem(this.queueKey, JSON.stringify(queue));
    }

    async enqueue(type: string, payload: any) {
        const queue = this.getQueue();
        const action: QueuedAction = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            payload,
            timestamp: Date.now()
        };
        queue.push(action);
        this.saveQueue(queue);

        // Notify the UI that an action was queued
        window.dispatchEvent(new CustomEvent('offline-action-queued', { detail: action }));

        return { queued: true, actionId: action.id };
    }

    async processQueue() {
        if (!navigator.onLine) return;

        const queue = this.getQueue();
        if (queue.length === 0) return;

        console.log(`Sincronizando ${queue.length} ações pendentes...`);

        const remainingQueue: QueuedAction[] = [];
        const results = [];

        for (const action of queue) {
            try {
                let result;
                switch (action.type) {
                    case 'BUY_QUOTA':
                        result = await apiService.buyQuotas(
                            action.payload.quantity,
                            action.payload.useBalance,
                            action.payload.paymentMethod
                        );
                        break;
                    case 'REQUEST_LOAN':
                        result = await apiService.requestLoan(
                            action.payload.amount,
                            action.payload.installments,
                            action.payload.guaranteePercentage
                        );
                        break;
                    case 'REPAY_LOAN':
                        result = await apiService.repayLoan(
                            action.payload.loanId,
                            action.payload.useBalance,
                            action.payload.paymentMethod
                        );
                        break;
                    case 'REPAY_INSTALLMENT':
                        result = await apiService.repayInstallment(
                            action.payload.loanId,
                            action.payload.amount,
                            action.payload.useBalance,
                            action.payload.paymentMethod
                        );
                        break;
                    case 'CLAIM_AD_REWARD':
                        result = await apiService.claimAdReward();
                        break;
                    case 'BUY_MARKETPLACE':
                        result = await apiService.post('/marketplace/buy', {
                            listingId: action.payload.listingId,
                            offlineToken: action.payload.offlineToken
                        });
                        break;
                    case 'RELEASE_ESCROW':
                        result = await apiService.post(`/marketplace/order/${action.payload.orderId}/receive`, {
                            verificationCode: action.payload.verificationCode
                        });
                        break;
                    default:
                        console.warn(`Tipo de ação desconhecido: ${action.type}`);
                        continue;
                }

                results.push({ id: action.id, success: true, result });
            } catch (error) {
                console.error(`Erro ao sincronizar ação ${action.id}:`, error);
                // Se o erro for de rede, mantém na fila. Se for erro de lógica/saldo, removemos mas avisamos.
                if (navigator.onLine && (error as any).message?.includes('offline')) {
                    remainingQueue.push(action);
                } else {
                    results.push({ id: action.id, success: false, error });
                }
            }
        }

        this.saveQueue(remainingQueue);

        if (results.length > 0) {
            window.dispatchEvent(new CustomEvent('offline-sync-completed', { detail: results }));
        }
    }

    hasPendingActions(): boolean {
        return this.getQueue().length > 0;
    }
}

export const syncService = new SyncService();
