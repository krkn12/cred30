import { Hono } from 'hono';
import { authMiddleware, securityLockMiddleware } from '../middleware/auth.middleware';
import { financialRateLimit } from '../middleware/rate-limit.middleware';
import { WithdrawalsController } from '../controllers/withdrawals.controller';

const withdrawalRoutes = new Hono();

// Aplicar rate limiting e trava de segurança para saques
withdrawalRoutes.use('/request', financialRateLimit, securityLockMiddleware);

// Solicitar saque (com rate limiting e security lock)
withdrawalRoutes.post('/request', authMiddleware, WithdrawalsController.requestWithdrawal);

// Confirmar saque
withdrawalRoutes.post('/confirm', authMiddleware, WithdrawalsController.confirmWithdrawal);

// Listar saques do usuário
withdrawalRoutes.get('/', authMiddleware, WithdrawalsController.listWithdrawals);

// Buscar limite de crédito disponível
withdrawalRoutes.get('/credit-limit', authMiddleware, WithdrawalsController.getCreditLimit);

export { withdrawalRoutes };