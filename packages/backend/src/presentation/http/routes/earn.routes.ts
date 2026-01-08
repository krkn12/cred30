import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { EarnController } from '../controllers/earn.controller';

export const earnRoutes = new Hono();

// Recompensa do Baú Diário
earnRoutes.post('/chest-reward', authMiddleware, EarnController.chestReward);

// Consultar status do baú
earnRoutes.get('/chest-status', authMiddleware, EarnController.getChestStatus);

// Recompensa de vídeo
earnRoutes.post('/video-reward', authMiddleware, EarnController.videoReward);

// Converter pontos
earnRoutes.post('/convert-points', authMiddleware, EarnController.convertPoints);

// Informações de pontos
earnRoutes.get('/points-info', authMiddleware, EarnController.getPointsInfo);

// Resgatar recompensa
earnRoutes.post('/redeem-reward', authMiddleware, EarnController.redeemReward);

// Catálogo de recompensas
earnRoutes.get('/rewards-catalog', authMiddleware, EarnController.getRewardsCatalog);
