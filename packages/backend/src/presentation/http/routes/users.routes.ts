import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { UsersController } from '../controllers/users.controller';

export const userRoutes = new Hono();

// Obter perfil do usuário atual
userRoutes.get('/profile', authMiddleware, UsersController.getProfile);

// Atualizar perfil do usuário
userRoutes.put('/profile', authMiddleware, UsersController.updateProfile);

// Completar perfil (CPF, PIX, Telefone)
userRoutes.post('/complete-profile', authMiddleware, UsersController.completeProfile);

// Obter saldo do usuário
userRoutes.get('/balance', authMiddleware, UsersController.getBalance);

// Endpoint de Sincronização Consolidada
userRoutes.get('/sync', authMiddleware, UsersController.syncData);

// Obter extrato de transações
userRoutes.get('/transactions', authMiddleware, UsersController.getTransactions);

// Excluir conta
userRoutes.delete('/me', authMiddleware, UsersController.deleteAccount);

// Alterar senha
userRoutes.post('/change-password', authMiddleware, UsersController.changePassword);

// Atualizar CPF
userRoutes.post('/update-cpf', authMiddleware, UsersController.updateCpf);

// Atualizar Telefone
userRoutes.post('/update-phone', authMiddleware, UsersController.updatePhone);

// Atualizar Chave PIX
userRoutes.post('/update-pix-key', authMiddleware, UsersController.updatePixKey);

// Recompensa Ad
userRoutes.post('/reward-ad', authMiddleware, UsersController.rewardAd);

// Elegibilidade de Título
userRoutes.get('/title-eligibility', authMiddleware, UsersController.getTitleEligibility);

// Download de Título
userRoutes.post('/title-download', authMiddleware, UsersController.titleDownload);

// Status de Benefício
userRoutes.get('/welcome-benefit', authMiddleware, UsersController.getWelcomeBenefitStatus);