import { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { notificationService } from '../../../application/services/notification.service';
import { UserContext } from '../../../shared/types/hono.types';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';

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
        const allowedOrigins = [
            'https://cred30.site',
            'https://www.cred30.site',
            'https://cred30-prod-app-2025.web.app',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:5173'
        ];
        const origin = c.req.header('Origin') || allowedOrigins[0];

        if (allowedOrigins.includes(origin) || origin.endsWith('cred30.site')) {
            c.header('Access-Control-Allow-Origin', origin);
            c.header('Access-Control-Allow-Credentials', 'true');
        } else {
            c.header('Access-Control-Allow-Origin', allowedOrigins[0]);
        }

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

            // Evento inicial para abrir o pipe imediatamente e confirmar no frontend
            stream.writeSSE({
                data: JSON.stringify({ message: 'SSE_CONNECTED', timestamp: Date.now() }),
                event: 'status',
                id: 'init'
            });

            // Ping para manter a conexão ativa em proxies (Render/Heroku/Nginx)
            const keepAlive = setInterval(() => {
                stream.writeSSE({ data: 'ping', event: 'ping' });
            }, 5000); // Reduzido de 15s para 5s

            stream.onAbort(() => {
                console.log(`📡 [SSE] Conexão abortada: ${user.id} (${connectionId})`);
                notificationService.removeClient(user.id, connectionId);
                clearInterval(keepAlive);
            });

            // Loop principal mantendo a conexão aberta
            while (true) {
                await stream.sleep(1000);
            }
        });
    }

    /**
     * Endpoint para testar se as notificações estão funcionando
     * Envia uma notificação de teste para o próprio usuário
     */
    static async sendTestNotification(c: Context) {
        const user = c.get('user') as UserContext;

        await notificationService.notifyUser(
            user.id,
            '🔔 Teste de Notificação',
            'Se você está vendo isso, o sistema de notificações está funcionando perfeitamente!'
        );

        return c.json({
            success: true,
            message: 'Notificação de teste enviada! Verifique o sino.'
        });
    }

    /**
     * Listar notificações do usuário (Histórico)
     */
    static async listNotifications(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(
                `SELECT id, title, message, type, is_read as read, created_at as date 
                 FROM notifications 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 50`,
                [user.id]
            );

            // Converter date para timestamp numérico para compatibilidade com interface do frontend
            const notifications = result.rows.map(n => ({
                ...n,
                date: new Date(n.date).getTime()
            }));

            return c.json({ success: true, data: notifications });
        } catch (error) {
            console.error('Erro ao listar notificações:', error);
            return c.json({ success: false, message: 'Erro ao buscar notificações' }, 500);
        }
    }

    /**
     * Marcar notificação como lida
     */
    static async markAsRead(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const { id } = await c.req.json();
            const pool = getDbPool(c);

            if (id === 'all') {
                await pool.query(
                    'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
                    [user.id]
                );
            } else {
                await pool.query(
                    'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
                    [id, user.id]
                );
            }

            return c.json({ success: true, message: 'Notificação marcada como lida' });
        } catch (error) {
            return c.json({ success: false, message: 'Erro ao atualizar notificação' }, 500);
        }
    }
    /**
     * Excluir notificação (Esvaziar lixeira)
     */
    static async deleteNotification(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const id = c.req.param('id');
            const pool = getDbPool(c);

            if (id === 'all') {
                await pool.query(
                    'DELETE FROM notifications WHERE user_id = $1',
                    [user.id]
                );
            } else {
                await pool.query(
                    'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
                    [id, user.id]
                );
            }

            return c.json({ success: true, message: 'Notificação excluída permanentemente' });
        } catch (error) {
            console.error('Erro ao excluir notificação:', error);
            return c.json({ success: false, message: 'Erro ao excluir notificação' }, 500);
        }
    }
}
