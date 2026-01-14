import { Hono } from 'hono';
import { TutorsController } from '../controllers/tutors.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const tutorRoutes = new Hono();

// Middleware de Autenticação Global para rotas de Tutor
tutorRoutes.use('*', authMiddleware);

tutorRoutes.post('/register', TutorsController.register);
tutorRoutes.get('/list', TutorsController.listTutors);
tutorRoutes.post('/request', TutorsController.requestClass);
tutorRoutes.post('/request/:id/respond', TutorsController.respondRequest); // :id = request_id
tutorRoutes.post('/request/:id/pay', TutorsController.payClass); // :id = request_id
tutorRoutes.get('/my-appointments', TutorsController.listMyAppointments); // Aluno vê seus agendamentos
tutorRoutes.get('/my-classes', TutorsController.listMyClasses); // Professor vê suas aulas

export { tutorRoutes };
