import { Hono } from 'hono';
import { WebhooksController } from '../controllers/webhooks.controller';

const webhookRoutes = new Hono();

// Webhook para compatibilidade
webhookRoutes.post('/payment', WebhooksController.handlePayment);

// Webhook de notificação genérico
webhookRoutes.post('/notify', WebhooksController.handleNotify);

export { webhookRoutes };
