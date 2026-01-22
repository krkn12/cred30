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

// Simulação de parcelamento (comerciante simula antes de cobrar)
pdvRoutes.get('/simulate-credit', authMiddleware, PdvController.simulateCredit);

// Rotas Públicas (Cliente acessa via QR Code)
// Detalhes da cobrança para confirmação remota
pdvRoutes.get('/charge/:id', PdvController.getChargeDetails);

// Rota de Confirmação (Cliente digita no PDV do comerciante ou confirma remotamente)
pdvRoutes.post('/confirm-charge', PdvController.confirmCharge);
