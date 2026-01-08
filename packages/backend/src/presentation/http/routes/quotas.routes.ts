import { Hono } from 'hono';
import { authMiddleware, securityLockMiddleware } from '../middleware/auth.middleware';
import { financialRateLimit } from '../middleware/rate-limit.middleware';
import { QuotasController } from '../controllers/quotas.controller';

const quotaRoutes = new Hono();

// Aplicar rate limiting a operações financeiras de cotas
quotaRoutes.use('/buy', financialRateLimit);
quotaRoutes.use('/sell', financialRateLimit);
quotaRoutes.use('/sell-all', financialRateLimit);

// Aplicar trava de segurança para ações financeiras
quotaRoutes.use('/buy', securityLockMiddleware);
quotaRoutes.use('/sell', securityLockMiddleware);
quotaRoutes.use('/sell-all', securityLockMiddleware);

// Listar cotas do usuário
quotaRoutes.get('/', authMiddleware, QuotasController.listQuotas);

// Comprar cotas
quotaRoutes.post('/buy', authMiddleware, QuotasController.buyQuotas);

// Vender uma cota
quotaRoutes.post('/sell', authMiddleware, QuotasController.sellQuota);

// Vender todas as cotas
quotaRoutes.post('/sell-all', authMiddleware, QuotasController.sellAllQuotas);

export { quotaRoutes };