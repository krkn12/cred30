import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { WithdrawalsController } from '../controllers/withdrawals.controller';

const withdrawalRoutes = new Hono();

// Solicitar saque
withdrawalRoutes.post('/request', authMiddleware, WithdrawalsController.requestWithdrawal);

// Confirmar saque
withdrawalRoutes.post('/confirm', authMiddleware, WithdrawalsController.confirmWithdrawal);

// Listar saques do usuário
withdrawalRoutes.get('/', authMiddleware, WithdrawalsController.listWithdrawals);

// Buscar limite de crédito disponível
withdrawalRoutes.get('/credit-limit', authMiddleware, WithdrawalsController.getCreditLimit);

export { withdrawalRoutes };