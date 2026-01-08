import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { SellerController } from '../controllers/seller.controller';

export const sellerRoutes = new Hono();

// Verifica se o usuário atual é vendedor e seu status
sellerRoutes.get('/status', authMiddleware, SellerController.getStatus);

// Registra o usuário como vendedor (registro local, sem Asaas)
sellerRoutes.post('/register', authMiddleware, SellerController.registerSeller);

// Retorna o walletId do vendedor (usado para splits)
sellerRoutes.get('/wallet', authMiddleware, SellerController.getWallet);

// Retorna o walletId de um vendedor específico (para usar em compras)
sellerRoutes.get('/:userId/wallet', authMiddleware, SellerController.getSellerWalletById);
