import { Hono } from 'hono';
import { authMiddleware, securityLockMiddleware } from '../middleware/auth.middleware';
import { LoansController } from '../controllers/loans.controller';

const loanRoutes = new Hono();

// Aplicar trava de segurança para solicitações e pagamentos
loanRoutes.use('/request', securityLockMiddleware);
loanRoutes.use('/repay', securityLockMiddleware);
loanRoutes.use('/repay-installment', securityLockMiddleware);

// Listar empréstimos do usuário
loanRoutes.get('/', authMiddleware, LoansController.listLoans);

// Obter limite de crédito disponível
loanRoutes.get('/available-limit', authMiddleware, LoansController.getAvailableLimit);

// Solicitar empréstimo
loanRoutes.post('/request', authMiddleware, LoansController.requestLoan);

// Pagar apoio
loanRoutes.post('/repay', authMiddleware, LoansController.repayLoan);

// Pagar parcela
loanRoutes.post('/repay-installment', authMiddleware, LoansController.repayInstallment);

export { loanRoutes };