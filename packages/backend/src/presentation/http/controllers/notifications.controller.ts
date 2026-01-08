import { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { notificationService } from '../../../application/services/notification.service';
import { UserContext } from '../../../shared/types/hono.types';

export class NotificationsController {
    /**
     * Endpoint para inscrição em notificações em tempo real (SSE)
     */
    static async streamNotifications(c: Context) {
        const user = c.get('user') as UserContext;

        return streamSSE(c, async (stream) => {
            const send = (data: any) => {
                stream.writeSSE({
                    data: JSON.stringify(data),
                    event: data.event || 'message',
                    id: Date.now().toString(),
                });
            };

            notificationService.addClient(user.id, send);

            const keepAlive = setInterval(() => {
                stream.writeSSE({ data: 'ping', event: 'ping' });
            }, 30000);

            stream.onAbort(() => {
                notificationService.removeClient(user.id);
                clearInterval(keepAlive);
            });

            while (true) {
                await stream.sleep(1000);
            }
        });
    }
}
