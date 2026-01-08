import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { MonetizationController } from '../controllers/monetization.controller';

const monetizationRoutes = new Hono();

// Recompensa por Video (Rewarded Ads)
monetizationRoutes.post('/reward-video', authMiddleware, MonetizationController.rewardVideo);

// Assinatura Cred30 PRO
monetizationRoutes.post('/upgrade-pro', authMiddleware, MonetizationController.upgradePro);

// Comprar Selo de Verificado
monetizationRoutes.post('/buy-verified-badge', authMiddleware, MonetizationController.buyVerifiedBadge);

// Comprar Pacote de Score (Boost)
monetizationRoutes.post('/buy-score-boost', authMiddleware, MonetizationController.buyScoreBoost);

// Check-in Diário
monetizationRoutes.post('/daily-checkin', authMiddleware, MonetizationController.dailyCheckin);

// Consulta de Reputação de Terceiros
monetizationRoutes.get('/reputation-check/:email', authMiddleware, MonetizationController.reputationCheck);

export { monetizationRoutes };
