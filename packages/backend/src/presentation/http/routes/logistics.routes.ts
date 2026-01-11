import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { LogisticsController } from '../controllers/logistics.controller';

const logisticsRoutes = new Hono();

// Lista entregas disponíveis para entregadores
logisticsRoutes.get('/available', authMiddleware, LogisticsController.listAvailable);

// Entregador aceita uma entrega
logisticsRoutes.post('/accept/:orderId', authMiddleware, LogisticsController.acceptDelivery);

// Entregador confirma que coletou o produto com o vendedor
logisticsRoutes.post('/pickup/:orderId', authMiddleware, LogisticsController.pickupDelivery);

// Entregador confirma que entregou ao comprador
logisticsRoutes.post('/delivered/:orderId', authMiddleware, LogisticsController.markDelivered);

// Entregador cancela a entrega aceita (antes de coletar)
logisticsRoutes.post('/cancel/:orderId', authMiddleware, LogisticsController.cancelDelivery);

// Lista entregas do entregador (ativas e histórico)
logisticsRoutes.get('/my-deliveries', authMiddleware, LogisticsController.listMyDeliveries);

// Estatísticas do entregador
logisticsRoutes.get('/stats', authMiddleware, LogisticsController.getStats);

// Status do cadastro de entregador
logisticsRoutes.get('/status', authMiddleware, LogisticsController.getCourierStatus);

// Atualizar preço por KM do entregador
logisticsRoutes.post('/update-price', authMiddleware, LogisticsController.updateCourierPrice);

export { logisticsRoutes };

