import { Hono } from 'hono';
import { TermsController } from '../controllers/terms.controller';
import { authMiddleware } from '../middleware/auth.middleware';

export const termsRoutes = new Hono();

// Rotas públicas (textos dos termos)
termsRoutes.get('/seller/text', TermsController.getSellerTermsText);
termsRoutes.get('/courier/text', TermsController.getCourierTermsText);

// Rotas autenticadas
termsRoutes.get('/status', authMiddleware, TermsController.getTermsStatus);
termsRoutes.post('/seller/accept', authMiddleware, TermsController.acceptSellerTerms);
termsRoutes.post('/courier/accept', authMiddleware, TermsController.acceptCourierTerms);
