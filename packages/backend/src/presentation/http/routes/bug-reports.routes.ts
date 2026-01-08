import { Hono } from 'hono';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { BugReportsController } from '../controllers/bug-reports.controller';

export const bugReportsRoutes = new Hono();

// Criar um bug report (usuário autenticado)
bugReportsRoutes.post('/', authMiddleware, BugReportsController.createBugReport);

// Listar meus bugs reportados (usuário autenticado)
bugReportsRoutes.get('/my', authMiddleware, BugReportsController.listMyBugs);

// ==================== ROTAS ADMINISTRATIVAS ====================

// Listar todos os bugs (admin)
bugReportsRoutes.get('/admin', authMiddleware, adminMiddleware, BugReportsController.adminListAllBugs);

// Atualizar status de um bug (admin)
bugReportsRoutes.patch('/admin/:id', authMiddleware, adminMiddleware, BugReportsController.adminUpdateBug);

// Excluir um bug (admin)
bugReportsRoutes.delete('/admin/:id', authMiddleware, adminMiddleware, BugReportsController.adminDeleteBug);
