import { Hono } from 'hono';
import { PdvController } from '../controllers/pdv.controller';
import { authMiddleware } from '../middleware/auth.middleware';


const pdvRoutes = new Hono();

// Todas as rotas requerem autenticação
pdvRoutes.use('*', authMiddleware);

// ========================================
// PLANOS E ASSINATURAS
// ========================================

// Listar planos disponíveis
pdvRoutes.get('/plans', PdvController.getPlans);

// Status da assinatura do usuário
pdvRoutes.get('/subscription', PdvController.getSubscriptionStatus);

// Assinar plano PDV
pdvRoutes.post('/subscribe', PdvController.subscribe);

// Cancelar assinatura
pdvRoutes.post('/subscription/cancel', PdvController.cancelSubscription);

// ========================================
// DISPOSITIVOS/MÁQUINAS
// ========================================

// Listar dispositivos
pdvRoutes.get('/devices', PdvController.getDevices);

// Registrar novo dispositivo
pdvRoutes.post('/devices', PdvController.registerDevice);

// Desativar dispositivo
pdvRoutes.delete('/devices/:deviceId', PdvController.deactivateDevice);

// ========================================
// PRODUTOS (CATÁLOGO LOCAL)
// ========================================

// Listar produtos
pdvRoutes.get('/products', PdvController.getProducts);

// Criar produto
pdvRoutes.post('/products', PdvController.createProduct);

// Atualizar produto (preço, estoque, nome etc.)
pdvRoutes.put('/products/:productId', PdvController.updateProduct);

// Excluir produto (soft delete)
pdvRoutes.delete('/products/:productId', PdvController.deleteProduct);

// ========================================
// VENDAS
// ========================================

// Listar vendas
pdvRoutes.get('/sales', PdvController.getSales);

// Registrar venda
pdvRoutes.post('/sales', PdvController.createSale);

// ========================================
// CLIENTES CRED30 (BUSCA PARA PAGAMENTO)
// ========================================

// Buscar cliente por telefone (para pagamento via Cred30)
pdvRoutes.post('/customer/lookup', PdvController.lookupCustomer);

export { pdvRoutes };
