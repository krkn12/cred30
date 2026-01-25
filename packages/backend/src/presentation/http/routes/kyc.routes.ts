
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { KycController } from '../controllers/kyc.controller';

const kycRoutes = new Hono();

// Upload pelo usuário
kycRoutes.post('/upload', authMiddleware, KycController.uploadDocument);

// Visualização Segura (Admin ou Próprio)
kycRoutes.get('/doc/:userId', authMiddleware, KycController.viewDocument);

// Revisão pelo Admin
kycRoutes.post('/review', authMiddleware, KycController.reviewKyc);

export { kycRoutes };
