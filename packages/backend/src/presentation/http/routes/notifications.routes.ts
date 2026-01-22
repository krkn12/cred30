import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { NotificationsController } from '../controllers/notifications.controller';

const notificationRoutes = new Hono();

// Endpoint para inscrição em notificações em tempo real (SSE)
notificationRoutes.get('/stream', authMiddleware, NotificationsController.streamNotifications);

// Endpoint para teste de notificação (verifica se o sino está funcionando)
notificationRoutes.post('/test', authMiddleware, NotificationsController.sendTestNotification);

export { notificationRoutes };
