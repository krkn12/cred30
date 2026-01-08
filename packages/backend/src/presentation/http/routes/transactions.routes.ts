import { Hono } from 'hono';
import { authMiddleware, securityLockMiddleware } from '../middleware/auth.middleware';
import { TransactionsController } from '../controllers/transactions.controller';
import { financialRateLimit } from '../middleware/rate-limit.middleware';

const transactionRoutes = new Hono();

// Aplicar rate limiting a operações financeiras
transactionRoutes.use('/withdraw', financialRateLimit);

// Listar transações do usuário com paginação
transactionRoutes.get('/', authMiddleware, TransactionsController.listTransactions);

// Solicitar saque
transactionRoutes.post('/withdraw', authMiddleware, securityLockMiddleware, TransactionsController.withdraw);

// Obter saldo do usuário
transactionRoutes.get('/balance', authMiddleware, TransactionsController.getBalance);

// Solicitar Depósito (Manual)
transactionRoutes.post('/deposit', authMiddleware, TransactionsController.deposit);

// Enviar avaliação de transação (saque)
transactionRoutes.post('/review', authMiddleware, TransactionsController.reviewTransaction);

// Listar avaliações públicas aprovadas (depoimentos)
transactionRoutes.get('/reviews/public', TransactionsController.getPublicReviews);

// Buscar transações pendentes de avaliação
transactionRoutes.get('/pending-reviews', authMiddleware, TransactionsController.getPendingReviews);

export { transactionRoutes };
