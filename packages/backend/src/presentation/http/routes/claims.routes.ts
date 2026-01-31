import { Hono } from 'hono';
import { ClaimsController } from '../controllers/claims.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

export const claimsRoutes = new Hono();

// Rotas para entregadores (autenticados)
claimsRoutes.post('/create', authMiddleware, ClaimsController.createClaim);

// Rotas para admin
claimsRoutes.get('/list', authMiddleware, adminMiddleware, ClaimsController.listClaims);
claimsRoutes.get('/:id', authMiddleware, adminMiddleware, ClaimsController.getClaimDetails);
claimsRoutes.post('/:id/resolve', authMiddleware, adminMiddleware, ClaimsController.resolveClaim);
