import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, createTransaction } from '../../../domain/services/transaction.service';
import { PoolClient } from 'pg';

const educationRoutes = new Hono();

// ============================================
// CONSTANTES
// ============================================
const INSTRUCTOR_SHARE = 0.70;  // 70% para o instrutor
const INVESTORS_SHARE = 0.20;   // 20% para cotistas (profit_pool)
const PLATFORM_SHARE = 0.10;    // 10% para plataforma (system_balance - custos)

// Taxa de conversão para sistema de pontos legado
const POINTS_TO_CURRENCY_RATE = 0.03 / 1000;
const POINTS_TO_SCORE_RATE = 0.02;

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================
const createCourseSchema = z.object({
    title: z.string().min(5).max(200),
    description: z.string().min(10).max(2000),
    price: z.number().min(0).max(9999),
    category: z.string().optional(),
    thumbnailUrl: z.string().url().optional()
});

const addLessonSchema = z.object({
    courseId: z.number(),
    title: z.string().min(3).max(200),
    description: z.string().optional(),
    youtubeUrl: z.string().min(10), // Link do YouTube
    durationMinutes: z.number().optional(),
    isPreview: z.boolean().optional()
});

const rewardSchema = z.object({
    points: z.number().positive(),
    lessonId: z.string().or(z.number()),
    sessionId: z.number()
});

// ============================================
// ROTAS DE CURSOS
// ============================================

/**
 * Criar um novo curso (instrutor)
 */
educationRoutes.post('/courses/create', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const body = await c.req.json();
        const data = createCourseSchema.parse(body);
        const pool = getDbPool(c);

        const result = await pool.query(`
            INSERT INTO courses (instructor_id, title, description, price, category, thumbnail_url, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'APPROVED')
            RETURNING id, title, price, status
        `, [user.id, data.title, data.description, data.price, data.category || 'GERAL', data.thumbnailUrl || null]);

        return c.json({
            success: true,
            message: 'Curso criado com sucesso!',
            data: result.rows[0]
        });
    } catch (e: any) {
        console.error('[COURSES] Erro ao criar curso:', e);
        return c.json({ success: false, message: e.message }, 500);
    }
});

/**
 * Adicionar aula a um curso (instrutor)
 */
educationRoutes.post('/courses/add-lesson', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const body = await c.req.json();
        const data = addLessonSchema.parse(body);
        const pool = getDbPool(c);

        // Verificar se o usuário é o dono do curso
        const courseRes = await pool.query(
            'SELECT id, instructor_id FROM courses WHERE id = $1',
            [data.courseId]
        );

        if (courseRes.rows.length === 0) {
            return c.json({ success: false, message: 'Curso não encontrado.' }, 404);
        }

        if (courseRes.rows[0].instructor_id !== user.id) {
            return c.json({ success: false, message: 'Você não é o instrutor deste curso.' }, 403);
        }

        // Pegar próximo order_index
        const orderRes = await pool.query(
            'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM course_lessons WHERE course_id = $1',
            [data.courseId]
        );
        const orderIndex = orderRes.rows[0].next_order;

        const result = await pool.query(`
            INSERT INTO course_lessons (course_id, title, description, youtube_url, duration_minutes, order_index, is_preview)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, title, order_index
        `, [data.courseId, data.title, data.description || '', data.youtubeUrl, data.durationMinutes || 0, orderIndex, data.isPreview || false]);

        return c.json({
            success: true,
            message: 'Aula adicionada com sucesso!',
            data: result.rows[0]
        });
    } catch (e: any) {
        console.error('[COURSES] Erro ao adicionar aula:', e);
        return c.json({ success: false, message: e.message }, 500);
    }
});

/**
 * Listar cursos disponíveis
 */
educationRoutes.get('/courses', authMiddleware, async (c) => {
    try {
        const pool = getDbPool(c);
        const category = c.req.query('category');

        let query = `
            SELECT c.*, u.name as instructor_name, u.is_verified as instructor_verified,
                   (SELECT COUNT(*) FROM course_lessons WHERE course_id = c.id) as total_lessons
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
            WHERE c.status = 'APPROVED'
        `;

        const params: any[] = [];
        if (category) {
            params.push(category);
            query += ` AND c.category = $${params.length}`;
        }

        query += ' ORDER BY c.created_at DESC LIMIT 50';

        const result = await pool.query(query, params);

        return c.json({
            success: true,
            data: result.rows
        });
    } catch (e: any) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

/**
 * Ver detalhes de um curso
 */
educationRoutes.get('/courses/:id', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const courseId = parseInt(c.req.param('id'));
        const pool = getDbPool(c);

        // Buscar curso
        const courseRes = await pool.query(`
            SELECT c.*, u.name as instructor_name, u.is_verified as instructor_verified
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
            WHERE c.id = $1
        `, [courseId]);

        if (courseRes.rows.length === 0) {
            return c.json({ success: false, message: 'Curso não encontrado.' }, 404);
        }

        const course = courseRes.rows[0];

        // Verificar se comprou
        const purchaseRes = await pool.query(
            'SELECT id FROM course_purchases WHERE user_id = $1 AND course_id = $2',
            [user.id, courseId]
        );
        const hasPurchased = purchaseRes.rows.length > 0 || course.instructor_id === user.id;

        // Buscar aulas (se comprou, mostra todas; senão, só preview)
        let lessonsQuery = `
            SELECT id, title, description, duration_minutes, order_index, is_preview
            ${hasPurchased ? ', youtube_url' : ''}
            FROM course_lessons
            WHERE course_id = $1
        `;
        if (!hasPurchased) {
            lessonsQuery += ' AND is_preview = TRUE';
        }
        lessonsQuery += ' ORDER BY order_index ASC';

        const lessonsRes = await pool.query(lessonsQuery, [courseId]);

        return c.json({
            success: true,
            data: {
                ...course,
                hasPurchased,
                lessons: lessonsRes.rows
            }
        });
    } catch (e: any) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

/**
 * Comprar curso com saldo
 */
educationRoutes.post('/courses/:id/buy', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const courseId = parseInt(c.req.param('id'));
        const pool = getDbPool(c);

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // Buscar curso
            const courseRes = await client.query(
                'SELECT id, instructor_id, price, title FROM courses WHERE id = $1 AND status = $2',
                [courseId, 'APPROVED']
            );

            if (courseRes.rows.length === 0) {
                throw new Error('Curso não encontrado ou não disponível.');
            }

            const course = courseRes.rows[0];

            // Não pode comprar próprio curso
            if (course.instructor_id === user.id) {
                throw new Error('Você não pode comprar seu próprio curso.');
            }

            // Verificar se já comprou
            const existingPurchase = await client.query(
                'SELECT id FROM course_purchases WHERE user_id = $1 AND course_id = $2',
                [user.id, courseId]
            );

            if (existingPurchase.rows.length > 0) {
                throw new Error('Você já possui este curso.');
            }

            // Curso grátis?
            if (parseFloat(course.price) === 0) {
                await client.query(`
                    INSERT INTO course_purchases (user_id, course_id, amount_paid, instructor_share, platform_share)
                    VALUES ($1, $2, 0, 0, 0)
                `, [user.id, courseId]);

                await client.query('UPDATE courses SET total_students = total_students + 1 WHERE id = $1', [courseId]);

                return { success: true, free: true };
            }

            // Verificar saldo
            const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
            const userBalance = parseFloat(userRes.rows[0].balance || '0');
            const price = parseFloat(course.price);

            if (userBalance < price) {
                throw new Error(`Saldo insuficiente. Você tem R$ ${userBalance.toFixed(2)}, mas precisa de R$ ${price.toFixed(2)}.`);
            }

            // Calcular divisão tripla
            const instructorShare = price * INSTRUCTOR_SHARE;  // 70% instrutor
            const investorsShare = price * INVESTORS_SHARE;    // 20% cotistas
            const platformShare = price * PLATFORM_SHARE;      // 10% plataforma

            // Debitar do comprador
            await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [price, user.id]);

            // Creditar no instrutor (70%)
            await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [instructorShare, course.instructor_id]);

            // Creditar cotistas (20%) - vai pro profit_pool (distribuído para quem tem cotas!)
            await client.query('UPDATE system_config SET profit_pool = profit_pool + $1', [investorsShare]);

            // Creditar plataforma (10%) - vai pro system_balance (custos operacionais)
            await client.query('UPDATE system_config SET system_balance = system_balance + $1', [platformShare]);

            // Registrar compra
            await client.query(`
                INSERT INTO course_purchases (user_id, course_id, amount_paid, instructor_share, platform_share)
                VALUES ($1, $2, $3, $4, $5)
            `, [user.id, courseId, price, instructorShare, investorsShare + platformShare]);

            // Atualizar estatísticas do curso
            await client.query(`
                UPDATE courses SET total_students = total_students + 1, total_revenue = total_revenue + $1 WHERE id = $2
            `, [price, courseId]);

            // Criar transação para o comprador
            await createTransaction(client, String(user.id), 'COURSE_PURCHASE', -price, `Compra: ${course.title}`, 'APPROVED');

            // Criar transação para o instrutor
            await createTransaction(client, String(course.instructor_id), 'COURSE_SALE', instructorShare, `Venda: ${course.title}`, 'APPROVED');

            return { success: true, price, instructorShare, platformShare };
        });

        if (!result.success) {
            return c.json({ success: false, message: result.error }, 400);
        }

        return c.json({
            success: true,
            message: result.data?.free ? 'Curso adicionado à sua biblioteca!' : 'Curso comprado com sucesso!',
            data: result.data
        });
    } catch (e: any) {
        console.error('[COURSES] Erro ao comprar:', e);
        return c.json({ success: false, message: e.message }, 500);
    }
});

/**
 * Meus cursos (como aluno)
 */
educationRoutes.get('/my-courses', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const result = await pool.query(`
            SELECT c.*, cp.created_at as purchased_at,
                   (SELECT COUNT(*) FROM course_lessons WHERE course_id = c.id) as total_lessons,
                   (SELECT COUNT(*) FROM course_progress WHERE user_id = $1 AND course_id = c.id AND completed = TRUE) as completed_lessons
            FROM course_purchases cp
            JOIN courses c ON cp.course_id = c.id
            WHERE cp.user_id = $1
            ORDER BY cp.created_at DESC
        `, [user.id]);

        return c.json({
            success: true,
            data: result.rows
        });
    } catch (e: any) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

/**
 * Meus cursos (como instrutor)
 */
educationRoutes.get('/my-teaching', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const result = await pool.query(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM course_lessons WHERE course_id = c.id) as total_lessons
            FROM courses c
            WHERE c.instructor_id = $1
            ORDER BY c.created_at DESC
        `, [user.id]);

        return c.json({
            success: true,
            data: result.rows
        });
    } catch (e: any) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

// ============================================
// ROTAS LEGADAS (Sistema de pontos)
// ============================================

educationRoutes.post('/start-session', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const body = await c.req.json();
        const { lessonId } = body;
        const pool = getDbPool(c);

        await pool.query('UPDATE education_sessions SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE', [user.id]);

        const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
        const ua = c.req.header('user-agent') || 'Unknown';

        const result = await pool.query(`
            INSERT INTO education_sessions (user_id, video_id, ip_address, user_agent)
            VALUES ($1, $2, $3, $4) RETURNING id
        `, [user.id, String(lessonId), ip, ua]);

        return c.json({ success: true, data: { sessionId: result.rows[0].id } });
    } catch (e: any) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

educationRoutes.post('/reward', authMiddleware, async (c) => {
    try {
        const body = await c.req.json();
        const { points, lessonId, sessionId } = rewardSchema.parse(body);
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const sessionRes = await pool.query(
            'SELECT * FROM education_sessions WHERE id = $1 AND user_id = $2 AND is_active = TRUE',
            [sessionId, user.id]
        );

        if (sessionRes.rows.length === 0) {
            return c.json({ success: false, message: 'Sessão inválida ou já finalizada.' }, 403);
        }

        const session = sessionRes.rows[0];
        const startTime = new Date(session.started_at).getTime();
        const now = Date.now();
        const elapsedSeconds = (now - startTime) / 1000;
        const minRequiredSeconds = (points / 0.5) * 0.9;

        if (elapsedSeconds < minRequiredSeconds) {
            return c.json({ success: false, message: 'Tempo de estudo insuficiente.' }, 400);
        }

        const amountToPayRaw = points * POINTS_TO_CURRENCY_RATE;
        const amountToPay = Math.floor(amountToPayRaw * 100) / 100;
        const scoreToAdd = Math.floor(points * POINTS_TO_SCORE_RATE);

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            await client.query('UPDATE education_sessions SET is_active = FALSE, total_seconds = $1 WHERE id = $2', [Math.floor(elapsedSeconds), sessionId]);

            const systemConfigResult = await client.query('SELECT profit_pool FROM system_config LIMIT 1 FOR UPDATE');
            const currentProfitPool = parseFloat(systemConfigResult.rows[0].profit_pool);

            if (currentProfitPool < amountToPay) throw new Error('LIMIT_REACHED');

            if (amountToPay > 0) {
                await client.query('UPDATE system_config SET profit_pool = profit_pool - $1', [amountToPay]);
                await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amountToPay, user.id]);
            }

            if (scoreToAdd > 0) {
                await client.query('UPDATE users SET score = score + $1 WHERE id = $2', [scoreToAdd, user.id]);
            }

            const txResult = await client.query(`
                INSERT INTO transactions (user_id, type, amount, description, status, metadata)
                VALUES ($1, 'EDUCATION_REWARD', $2, $3, 'COMPLETED', $4)
                RETURNING id`,
                [user.id, amountToPay, `Recompensa Academy - Aula #${lessonId}`, JSON.stringify({ points, lessonId, sessionId })]
            );

            return { transactionId: txResult.rows[0].id, amount: amountToPay, scoreAdded: scoreToAdd };
        });

        return c.json({ success: true, message: 'Recompensa creditada!', data: result });

    } catch (error: any) {
        if (error.message === 'LIMIT_REACHED') return c.json({ success: false, message: 'Limite do Fundo atingido.' }, 429);
        return c.json({ success: false, message: error.message || 'Erro interno' }, 500);
    }
});

export { educationRoutes };

