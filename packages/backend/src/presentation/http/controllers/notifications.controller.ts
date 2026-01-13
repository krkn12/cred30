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

        // Headers recomendados para SSE e para evitar cache de proxies/Nginx
        c.header('Content-Type', 'text/event-stream');
        c.header('Cache-Control', 'no-cache, no-transform');
        c.header('Connection', 'keep-alive');
        c.header('X-Accel-Buffering', 'no'); // Crítico para Nginx/Render

        // Garantia extra de CORS para o Stream SSE
        const origin = c.req.header('Origin') || 'https://cred30.site';
        c.header('Access-Control-Allow-Origin', origin);
        c.header('Access-Control-Allow-Credentials', 'true');

        return streamSSE(c, async (stream) => {
            const connectionId = Math.random().toString(36).substring(7);

            const send = (data: any) => {
                stream.writeSSE({
                    data: JSON.stringify(data),
                    event: data.event || 'message',
                    id: Date.now().toString(),
                });
            };

            notificationService.addClient(user.id, connectionId, send);

            // Ping para manter a conexão ativa em proxies (Render/Heroku/etc)
            const keepAlive = setInterval(() => {
                stream.writeSSE({ data: 'ping', event: 'ping' });
            }, 15000);

            stream.onAbort(() => {
                notificationService.removeClient(user.id, connectionId);
                clearInterval(keepAlive);
            });

            // Loop principal mantendo a conexão aberta
            while (true) {
                await stream.sleep(1000);
            }
        });
    }
}
