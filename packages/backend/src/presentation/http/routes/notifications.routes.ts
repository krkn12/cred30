import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { NotificationsController } from '../controllers/notifications.controller';

const notificationRoutes = new Hono();

// Endpoint para inscrição em notificações em tempo real (SSE)
notificationRoutes.get('/stream', authMiddleware, NotificationsController.streamNotifications);

// Histórico e Gerenciamento
notificationRoutes.get('/', authMiddleware, NotificationsController.listNotifications);
notificationRoutes.get('', authMiddleware, NotificationsController.listNotifications); // Alias para evitar 404 com/sem barra no final
notificationRoutes.put('/read', authMiddleware, NotificationsController.markAsRead);
notificationRoutes.delete('/:id', authMiddleware, NotificationsController.deleteNotification); // Nova rota de deleção

// Endpoint para teste de notificação (verifica se o sino está funcionando)
notificationRoutes.post('/test', authMiddleware, NotificationsController.sendTestNotification);

export { notificationRoutes };
