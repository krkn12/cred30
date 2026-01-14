
import { Hono } from 'hono';
import { ConsortiumController } from '../controllers/consortium.controller';
import { authMiddleware } from '../../../middleware/auth.middleware';

export const consortiumRoutes = new Hono();

// Middleware de Autenticação Global para estas rotas
consortiumRoutes.use('*', authMiddleware);

// --- Grupos ---
consortiumRoutes.post('/groups', ConsortiumController.createGroup);
consortiumRoutes.get('/groups', ConsortiumController.listGroups);
consortiumRoutes.get('/my-groups', ConsortiumController.myConsortiums);

// --- Ações ---
consortiumRoutes.post('/join', ConsortiumController.joinGroup);

// --- Assembleia & Lances ---
consortiumRoutes.get('/groups/:groupId/assembly', ConsortiumController.getAssembly);
consortiumRoutes.post('/bid', ConsortiumController.placeBid);
consortiumRoutes.post('/vote', ConsortiumController.voteOnBid);
