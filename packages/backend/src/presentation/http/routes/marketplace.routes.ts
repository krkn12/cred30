import { Hono } from 'hono';
import { authMiddleware, securityLockMiddleware } from '../middleware/auth.middleware';
import { MarketplaceController } from '../controllers/marketplace.controller';
import { MarketplaceListingsController } from '../controllers/marketplace.listings.controller';
import { MarketplaceOrdersController } from '../controllers/marketplace.orders.controller';
import { MarketplaceEnhancementsController } from '../controllers/marketplace.enhancements.controller';

const marketplaceRoutes = new Hono();

// Aplicar trava de segurança para ações sensíveis de mercado
marketplaceRoutes.use('/create', securityLockMiddleware);
marketplaceRoutes.use('/buy', securityLockMiddleware);
marketplaceRoutes.use('/buy-on-credit', securityLockMiddleware);
marketplaceRoutes.use('/boost', securityLockMiddleware);

/**
 * LISTINGS (Anúncios)
 */
marketplaceRoutes.get('/listings', MarketplaceListingsController.getListings);
marketplaceRoutes.get('/listings/:id', MarketplaceListingsController.getListingDetails);
marketplaceRoutes.get('/my-listings', authMiddleware, MarketplaceListingsController.getMyListings);
marketplaceRoutes.post('/create', authMiddleware, MarketplaceListingsController.createListing);
marketplaceRoutes.delete('/delete/:id', authMiddleware, MarketplaceListingsController.deleteListing);
marketplaceRoutes.post('/boost', authMiddleware, MarketplaceListingsController.boostListing);
marketplaceRoutes.get('/contact/:listingId', authMiddleware, MarketplaceListingsController.getSellerContact);

/**
 * ORDERS (Pedidos)
 */
marketplaceRoutes.get('/my-orders', authMiddleware, MarketplaceOrdersController.getMyOrders);
marketplaceRoutes.post('/buy', authMiddleware, MarketplaceOrdersController.buyListing);
marketplaceRoutes.post('/buy-on-credit', authMiddleware, MarketplaceOrdersController.buyOnCredit);
marketplaceRoutes.post('/order/:id/cancel', authMiddleware, MarketplaceOrdersController.cancelOrder);
marketplaceRoutes.post('/order/:id/dispute', authMiddleware, MarketplaceOrdersController.openDispute);
marketplaceRoutes.post('/order/:id/rate', authMiddleware, MarketplaceOrdersController.rateOrder);
marketplaceRoutes.post('/order/:id/receive', authMiddleware, MarketplaceOrdersController.confirmReceipt);
marketplaceRoutes.get('/order/:id/tracking', authMiddleware, MarketplaceOrdersController.getOrderTracking);
marketplaceRoutes.post('/order/:id/return', authMiddleware, MarketplaceOrdersController.requestReturn);

/**
 * LOGISTICS & FINANCE (Logística e Financeiro)
 */
marketplaceRoutes.get('/logistic/quote', authMiddleware, MarketplaceOrdersController.getShippingQuote);
marketplaceRoutes.get('/logistic/missions', authMiddleware, MarketplaceController.getLogisticMissions);
marketplaceRoutes.post('/logistic/mission/:id/accept', authMiddleware, MarketplaceController.acceptMission);
marketplaceRoutes.post('/logistic/mission/:id/pickup', authMiddleware, MarketplaceController.pickupMission);
marketplaceRoutes.post('/logistic/mission/:id/location', authMiddleware, MarketplaceController.updateMissionLocation);
marketplaceRoutes.post('/logistic/settlement', authMiddleware, MarketplaceController.processSettlement);
marketplaceRoutes.post('/order/:id/anticipate', authMiddleware, MarketplaceController.anticipate);
marketplaceRoutes.post('/offline/sync', authMiddleware, MarketplaceController.syncOffline);

/**
 * ENHANCEMENTS - Mercado Livre Features (Favoritos, Perguntas, Avaliações)
 */
// Favoritos
marketplaceRoutes.post('/listing/:id/favorite', authMiddleware, MarketplaceEnhancementsController.toggleFavorite);
marketplaceRoutes.get('/favorites', authMiddleware, MarketplaceEnhancementsController.getMyFavorites);

// Perguntas e Respostas
marketplaceRoutes.post('/listing/:id/question', authMiddleware, MarketplaceEnhancementsController.askQuestion);
marketplaceRoutes.get('/listing/:id/questions', authMiddleware, MarketplaceEnhancementsController.getQuestions);
marketplaceRoutes.post('/question/:id/answer', authMiddleware, MarketplaceEnhancementsController.answerQuestion);

// Avaliações
marketplaceRoutes.post('/order/:id/review', authMiddleware, MarketplaceEnhancementsController.rateUser);
marketplaceRoutes.get('/seller/:id/reviews', authMiddleware, MarketplaceEnhancementsController.getUserReviews);
marketplaceRoutes.get('/seller/:id/profile', authMiddleware, MarketplaceEnhancementsController.getSellerProfile);

export { marketplaceRoutes };
