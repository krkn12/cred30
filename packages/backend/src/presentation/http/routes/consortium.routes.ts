
import { Hono } from 'hono';
import { ConsortiumController } from '../controllers/consortium.controller';
import { authMiddleware } from '../middleware/auth.middleware';

export const consortiumRoutes = new Hono();

// Middleware de Autenticação Global para estas rotas
consortiumRoutes.use('*', authMiddleware);

// --- Grupos ---
consortiumRoutes.post('/groups', ConsortiumController.createGroup);
consortiumRoutes.get('/groups', ConsortiumController.listGroups);
consortiumRoutes.get('/my-groups', ConsortiumController.myConsortiums);
consortiumRoutes.get('/stats', ConsortiumController.getPerformanceStats);
consortiumRoutes.get('/groups/:groupId/members', ConsortiumController.listMembers);

// --- Ações ---
consortiumRoutes.post('/join', ConsortiumController.joinGroup);
consortiumRoutes.post('/pay-installment', ConsortiumController.payInstallment);
consortiumRoutes.post('/withdraw', ConsortiumController.withdraw);

// --- Assembleia & Lances ---
consortiumRoutes.post('/assemblies', ConsortiumController.createAssembly);
consortiumRoutes.post('/assemblies/close', ConsortiumController.closeAssembly);
consortiumRoutes.get('/groups/:groupId/active-assembly', ConsortiumController.getActiveAssembly);
consortiumRoutes.get('/assemblies/:id', ConsortiumController.getAssembly);
consortiumRoutes.post('/bid', ConsortiumController.placeBid);
consortiumRoutes.post('/vote', ConsortiumController.voteOnBid);
consortiumRoutes.post('/approve-credit', ConsortiumController.approveCredit);
consortiumRoutes.post('/documents', ConsortiumController.addMemberDocument);
