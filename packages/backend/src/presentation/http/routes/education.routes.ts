import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { EducationController } from '../controllers/education.controller';

const educationRoutes = new Hono();

// Criar um novo curso (instrutor)
educationRoutes.post('/courses/create', authMiddleware, EducationController.createCourse);

// Adicionar aula a um curso (instrutor)
educationRoutes.post('/courses/add-lesson', authMiddleware, EducationController.addLesson);

// Listar cursos disponíveis
educationRoutes.get('/courses', authMiddleware, EducationController.listCourses);

// Ver detalhes de um curso
educationRoutes.get('/courses/:id', authMiddleware, EducationController.getCourseDetails);

// Comprar curso com saldo
educationRoutes.post('/courses/:id/buy', authMiddleware, EducationController.buyCourse);

// Meus cursos (como aluno)
educationRoutes.get('/my-courses', authMiddleware, EducationController.getMyCourses);

// Meus cursos (como instrutor)
educationRoutes.get('/my-teaching', authMiddleware, EducationController.getMyTeaching);

// Rotas legadas (Sistema de pontos)
educationRoutes.post('/start-session', authMiddleware, EducationController.startSession);
educationRoutes.post('/reward', authMiddleware, EducationController.reward);

export { educationRoutes };
