import { Hono } from 'hono';
import { authRateLimit } from '../middleware/rate-limit.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { AuthController } from '../controllers/auth.controller';
import { initializeFirebaseAdmin } from '../../../infrastructure/firebase/admin-config';

// Inicializar Firebase Admin
initializeFirebaseAdmin();

export const authRoutes = new Hono();

// Aplicar rate limiting às rotas de autenticação
authRoutes.post('/login', authRateLimit, AuthController.login);
authRoutes.post('/register', authRateLimit, AuthController.register);
authRoutes.post('/reset-password', authRateLimit, AuthController.resetPassword);

// Rota de verificação de 2FA (Ativação)
authRoutes.post('/verify-2fa', AuthController.verify2FA);

// Rota para obter dados de configuração de 2FA (Para usuários existentes)
authRoutes.get('/2fa/setup', authMiddleware, AuthController.setup2FA);

// Rota de logout
authRoutes.post('/logout', AuthController.logout);

// Rota para registrar aceite de termos
authRoutes.post('/accept-terms', authMiddleware, AuthController.acceptTerms);

// Rota para verificar se usuário aceitou termos atuais
authRoutes.get('/terms-status', authMiddleware, AuthController.termsStatus);

// Rota de recuperação de 2FA
authRoutes.post('/recover-2fa', AuthController.recover2FA);

// Rota para admin desabilitar 2FA de um usuário
authRoutes.post('/admin/disable-2fa', authMiddleware, AuthController.adminDisable2FA);

// Rota para admin resetar segurança de um usuário (Senha, Frase e 2FA)
authRoutes.post('/admin/reset-user-security', authMiddleware, AuthController.adminResetUserSecurity);

// Rota de autenticação via Google (Firebase)
authRoutes.post('/google', AuthController.loginGoogle);

// Rota para aplicar código de indicação (Pós-Login Social)
authRoutes.post('/apply-referral', authMiddleware, AuthController.applyReferral);