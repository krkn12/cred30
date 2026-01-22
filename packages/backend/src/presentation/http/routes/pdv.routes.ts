import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { PdvController } from '../controllers/pdv.controller';

export const pdvRoutes = new Hono();

// Rotas do Comerciante (precisa estar logado)
pdvRoutes.post('/create-charge', authMiddleware, PdvController.createCharge);
pdvRoutes.get('/search-customer', authMiddleware, PdvController.searchCustomer);
pdvRoutes.get('/my-sales', authMiddleware, PdvController.getMySales);
pdvRoutes.post('/cancel/:id', authMiddleware, PdvController.cancelCharge);
pdvRoutes.post('/become-merchant', authMiddleware, PdvController.becomeMerchant);

// Rota de Confirmação (Cliente digita no PDV do comerciante)
// Não precisa de authMiddleware pois o cliente confirma com ID + Senha
pdvRoutes.post('/confirm-charge', PdvController.confirmCharge);
