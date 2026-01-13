// Gerenciador de conexões em tempo real (SSE)
// Map<userId, Map<connectionId, sendFn>>
const clients = new Map<string, Map<string, (data: any) => void>>();

interface NotificationService {
    addClient(userId: string | number, connectionId: string, sendFn: (data: any) => void): void;
    removeClient(userId: string | number, connectionId: string): void;
    notifyAdmin(message: string, type?: 'ALERT' | 'INFO' | 'SUCCESS'): Promise<void>;
    notifyUser(userId: string | number, title: string, body: string): Promise<void>;
    notifyNewWithdrawal(userName: string, amount: number): Promise<void>;
    notifyProfitDistributed(totalAmount: number): Promise<void>;
    sendDuressAlert(userName: string, safePhone: string): Promise<void>;
}

/**
 * Serviço de Notificações Cred30
 * Gerencia o envio de alertas para usuários e administradores
 */
export const notificationService: NotificationService = {
    /**
     * Adiciona um cliente SSE
     */
    addClient(userId: string | number, connectionId: string, sendFn: (data: any) => void) {
        const uId = userId.toString();
        if (!clients.has(uId)) {
            clients.set(uId, new Map());
        }
        clients.get(uId)!.set(connectionId, sendFn);

        let total = 0;
        clients.forEach(c => total += c.size);
        console.log(`📡 [SSE] Cliente conectado: ${userId} (${connectionId}). Total: ${total}`);
    },

    /**
     * Remove um cliente SSE
     */
    removeClient(userId: string | number, connectionId: string) {
        const uId = userId.toString();
        const userClients = clients.get(uId);
        if (userClients) {
            userClients.delete(connectionId);
            if (userClients.size === 0) {
                clients.delete(uId);
            }
        }

        let total = 0;
        clients.forEach(c => total += c.size);
        console.log(`📡 [SSE] Cliente desconectado: ${userId} (${connectionId}). Total: ${total}`);
    },

    /**
     * Envia um alerta de sistema para o administrador
     */
    async notifyAdmin(message: string, type: 'ALERT' | 'INFO' | 'SUCCESS' = 'INFO') {
        const emoji = type === 'ALERT' ? '🚨' : type === 'SUCCESS' ? '✅' : 'ℹ️';
        console.log(`${emoji} [ADMIN NOTIFICATION]: ${message}`);

        // Broadcast silencioso para todos os admins conectados via SSE
        clients.forEach((userClients, userId) => {
            // No futuro, verificar se o userId é admin
            userClients.forEach((send) => {
                send({
                    event: 'admin_notification',
                    message,
                    type,
                    timestamp: new Date().toISOString()
                });
            });
        });
    },

    /**
     * Envia uma notificação para um usuário específico
     */
    async notifyUser(userId: string | number, title: string, body: string) {
        console.log(`🔔 [USER NOTIFICATION] User: ${userId} | ${title}: ${body}`);

        const userClients = clients.get(userId.toString());
        if (userClients) {
            userClients.forEach((send) => {
                send({
                    event: 'notification',
                    title,
                    body,
                    timestamp: new Date().toISOString()
                });
            });
        }
    },

    /**
     * Alerta sobre novo saque solicitado
     */
    async notifyNewWithdrawal(userName: string, amount: number) {
        const msg = `Novo saque solicitado!\nCliente: ${userName}\nValor: R$ ${amount.toFixed(2)}\n\nAcesse o painel para aprovar.`;
        await this.notifyAdmin(msg, 'ALERT');
    },

    /**
     * Alerta sobre lucro distribuído
     */
    async notifyProfitDistributed(totalAmount: number) {
        const msg = `Distribuição diária realizada com sucesso!\nTotal distribuído: R$ ${totalAmount.toFixed(2)}`;
        await this.notifyAdmin(msg, 'SUCCESS');
    },

    /**
     * Envia alerta de coação para o contato seguro
     */
    async sendDuressAlert(userName: string, safePhone: string) {
        const message = `🚨 ALERTA DE EMERGÊNCIA CRED30: O associado ${userName} acaba de ativar o modo de pânico no aplicativo. Isso indica uma situação de perigo ou coação. Por favor, tente contato ou chame as autoridades (190) se necessário.`;

        console.log(`⚠️ [DURESS ALERT SENT TO ${safePhone}]: ${message}`);

        // TODO: Integrar com API de WhatsApp/SMS (Ex: Twilio ou Z-API)
        // await smsGateway.send(safePhone, message);
    }
};
