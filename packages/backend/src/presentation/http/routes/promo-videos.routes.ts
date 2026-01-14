import { Hono } from 'hono';
import { authMiddleware, securityLockMiddleware } from '../middleware/auth.middleware';
import { PromoVideosController } from '../controllers/promo-videos.controller';

const promoVideosRoutes = new Hono();

// Aplicar middlewares
promoVideosRoutes.use('/create', securityLockMiddleware);
promoVideosRoutes.use('/*', authMiddleware);

// Listar tags disponíveis
promoVideosRoutes.get('/tags', PromoVideosController.getTags);

// Listar vídeos disponíveis para assistir (Feed)
promoVideosRoutes.get('/feed', PromoVideosController.getFeed);

// Farm de Views: Buscar o próximo vídeo disponível
promoVideosRoutes.get('/farm/next', PromoVideosController.getNextFarmVideo);

// Criar nova campanha
promoVideosRoutes.post('/create', PromoVideosController.createCampaign);



// Registrar início de view
promoVideosRoutes.post('/:videoId/start-view', PromoVideosController.startView);

// Completar view e receber pagamento
promoVideosRoutes.post('/:videoId/complete-view', PromoVideosController.completeView);

// Minhas campanhas (com ranking global)
promoVideosRoutes.get('/my-campaigns', PromoVideosController.getMyCampaigns);

// Meus ganhos assistindo vídeos
promoVideosRoutes.get('/my-earnings', PromoVideosController.getMyEarnings);

// Remover/Cancelar uma campanha
promoVideosRoutes.delete('/:id', PromoVideosController.deleteCampaign);

// Converter pontos em dinheiro
promoVideosRoutes.post('/convert-points', PromoVideosController.convertPoints);

export { promoVideosRoutes };
