import { Hono } from 'hono';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { VotingController } from '../controllers/voting.controller';

export const votingRoutes = new Hono();

// Middleware Global para todas as rotas de votação
votingRoutes.use('*', authMiddleware);

// Criar Proposta (Membros Engajados ou Admin)
votingRoutes.post('/proposals', VotingController.createProposal);

// Listar Propostas Democráticas
votingRoutes.get('/proposals', VotingController.listProposals);

// Votar (Modelo Quadrático + Reputação)
votingRoutes.post('/vote', VotingController.vote);

// Encerrar Votação e Computar Resultados (Admin Only)
votingRoutes.post('/proposals/:id/close', adminMiddleware, VotingController.closeProposal);
