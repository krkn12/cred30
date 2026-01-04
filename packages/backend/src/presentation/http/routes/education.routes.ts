import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, createTransaction, updateUserBalance } from '../../../domain/services/transaction.service';
import { PoolClient } from 'pg';
import { updateScore } from '../../../application/services/score.service';
import { ACADEMY_AUTHOR_SHARE, ACADEMY_PLATFORM_SHARE, ACADEMY_SUPPORTERS_SHARE } from '../../../shared/constants/business.constants';
import { createPixPayment, createCardPayment } from '../../../infrastructure/gateways/asaas.service';
import { calculateTotalToPay, PaymentMethod } from '../../../shared/utils/financial.utils';

const educationRoutes = new Hono();

const rewardSchema = z.object({
    points: z.number().positive(),
    lessonId: z.string().or(z.number()),
    sessionId: z.number()
});

// Taxa de conversão: 1000 pontos = R$ 0.03
const POINTS_TO_CURRENCY_RATE = 0.03 / 1000;
const POINTS_TO_SCORE_RATE = 0.02; // 2 Pontos de Score a cada 100 pts de estudo (Aumentado para ser perceptível)

educationRoutes.post('/start-session', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const body = await c.req.json();
        const { lessonId } = body;
        const pool = getDbPool(c);

        // Finalizar sessões anteriores do mesmo usuário (se houver)
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
        const user = c.get('user');
        const pool = getDbPool(c);

        // 1. Validar Sessão
        const sessionRes = await pool.query(
            'SELECT * FROM education_sessions WHERE id = $1 AND user_id = $2 AND is_active = TRUE',
            [sessionId, user.id]
        );

        if (sessionRes.rows.length === 0) {
            return c.json({ success: false, message: 'Sessão inválida ou já finalizada.' }, 403);
        }

        const session = sessionRes.rows[0];

        // 2. Anti-Cheat: Verificar tempo decorrido
        // Pontos ganhos: 0.5/seg. 100 pontos = 200 segundos.
        const startTime = new Date(session.started_at).getTime();
        const now = Date.now();
        const elapsedSeconds = (now - startTime) / 1000;

        // Margem de erro de 10% ou 5 segundos para compensar latência
        const minRequiredSeconds = (points / 0.5) * 0.9;

        if (elapsedSeconds < minRequiredSeconds) {
            console.warn(`[ANTI-CHEAT] User ${user.id} fast study: ${elapsedSeconds}s for ${points}pts (min: ${minRequiredSeconds}s)`);
            return c.json({ success: false, message: 'Segurança: Tempo de estudo insuficiente para estes pontos.' }, 400);
        }

        // Calcular valores
        const amountToPayRaw = points * POINTS_TO_CURRENCY_RATE;
        const amountToPay = Math.floor(amountToPayRaw * 100) / 100; // Arredonda para baixo em centavos para evitar discrepância
        const scoreToAdd = Math.floor(points * POINTS_TO_SCORE_RATE);

        if (amountToPay <= 0 && points >= 20) {
            // Se os pontos são suficientes para pelo menos R$ 0.01 mas o cálculo deu 0, forçar 0.01 se pontos > threshold
            // Threshold: 0.01 / 0.00029 ~= 35 pontos.
            // Mas vamos deixar o arredondamento natural por enquanto para ser justo com o caixa.
        }

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // Finalizar sessão
            await client.query('UPDATE education_sessions SET is_active = FALSE, total_seconds = $1 WHERE id = $2', [Math.floor(elapsedSeconds), sessionId]);

            // Verificar Profit Pool
            const systemConfigResult = await client.query('SELECT profit_pool FROM system_config LIMIT 1 FOR UPDATE');
            const currentProfitPool = parseFloat(systemConfigResult.rows[0].profit_pool);

            if (currentProfitPool < amountToPay) throw new Error('LIMIT_REACHED');

            // Debitar e Creditar
            if (amountToPay > 0) {
                await client.query('UPDATE system_config SET profit_pool = profit_pool - $1', [amountToPay]);
                await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amountToPay, user.id]);
            }

            if (scoreToAdd > 0) {
                await client.query('UPDATE users SET score = score + $1 WHERE id = $2', [scoreToAdd, user.id]);
            }

            // Transação
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
        if (error.message === 'LIMIT_REACHED') return c.json({ success: false, message: 'Limite do Fundo atingido. Tente mais tarde.' }, 429);
        console.error('Erro ao processar recompensa:', error);
        return c.json({ success: false, message: error.message || 'Erro interno' }, 500);
    }
});


// --- ADMIN: GERENCIAMENTO DE CURSOS ---

// Listar cursos pendentes ou todos para admin
educationRoutes.get('/admin/courses', authMiddleware, adminMiddleware, async (c) => {
    try {
        const pool = getDbPool(c);
        const status = c.req.query('status');
        let query = `
            SELECT c.*, u.name as author_name 
            FROM academy_courses c 
            JOIN users u ON c.author_id = u.id
        `;
        const params = [];

        if (status) {
            query += ` WHERE c.status = $1`;
            params.push(status);
        }

        query += ` ORDER BY c.created_at DESC`;

        const result = await pool.query(query, params);
        return c.json({ success: true, data: result.rows });
    } catch (e: any) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

// Aprovar/Rejeitar curso
educationRoutes.post('/admin/courses/:id/status', authMiddleware, adminMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const { status } = body; // APPROVED, REJECTED
        const pool = getDbPool(c);

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return c.json({ success: false, message: 'Status inválido' }, 400);
        }

        const result = await pool.query(
            'UPDATE academy_courses SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, author_id, title',
            [status, id]
        );

        if (result.rows.length === 0) {
            return c.json({ success: false, message: 'Curso não encontrado' }, 404);
        }

        const course = result.rows[0];

        // Notificar autor
        await pool.query(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES ($1, $2, $3, 'ACADEMY_COURSE_UPDATE')
        `, [
            course.author_id,
            status === 'APPROVED' ? '✅ Curso Aprovado!' : '❌ Curso Rejeitado',
            `Seu curso "${course.title}" foi ${status === 'APPROVED' ? 'aprovado e já está disponível na loja.' : 'analisado e não pôde ser aprovado no momento.'}`
        ]);

        return c.json({ success: true, message: `Curso ${status === 'APPROVED' ? 'aprovado' : 'rejeitado'} com sucesso!` });
    } catch (e: any) {
        return c.json({ success: false, message: e.message }, 500);
    }
});


// --- MARKETPLACE DE CURSOS (ESTILO UDEMY) ---

// Listar todos os cursos aprovados
educationRoutes.get('/courses', async (c) => {
    try {
        const pool = getDbPool(c);
        const result = await pool.query(`
            SELECT c.*, u.name as author_name 
            FROM academy_courses c 
            JOIN users u ON c.author_id = u.id 
            WHERE c.status = 'APPROVED'
            ORDER BY c.created_at DESC
        `);
        return c.json({ success: true, data: result.rows });
    } catch (e: any) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

// Criar novo curso (Professor)
educationRoutes.post('/courses', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const body = await c.req.json();
        const { title, description, price, video_url, thumbnail_url, category } = body;
        const pool = getDbPool(c);

        const result = await pool.query(`
            INSERT INTO academy_courses (author_id, title, description, price, video_url, thumbnail_url, category, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
            RETURNING id
        `, [user.id, title, description, price, video_url, thumbnail_url, category]);

        return c.json({ success: true, message: 'Curso enviado para análise!', data: { id: result.rows[0].id } });
    } catch (e: any) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

// Comprar um curso
educationRoutes.post('/courses/:id/buy', authMiddleware, async (c) => {
    try {
        const courseId = c.req.param('id');
        const user = c.get('user');
        const body = await c.req.json();
        const { useBalance, paymentMethod, installments } = body;
        const pool = getDbPool(c);

        // 1. Buscar curso
        const courseRes = await pool.query('SELECT * FROM academy_courses WHERE id = $1', [courseId]);
        if (courseRes.rows.length === 0) return c.json({ success: false, message: 'Curso não encontrado' }, 404);
        const course = courseRes.rows[0];

        // 2. Verificar se já possui
        const enrollmentRes = await pool.query('SELECT * FROM academy_enrollments WHERE user_id = $1 AND course_id = $2', [user.id, courseId]);
        if (enrollmentRes.rows.length > 0) return c.json({ success: false, message: 'Você já possui este curso' }, 400);

        const price = parseFloat(course.price);

        // Se o curso for grátis
        if (price <= 0) {
            await pool.query('INSERT INTO academy_enrollments (user_id, course_id, amount_paid, status) VALUES ($1, $2, 0, \'COMPLETED\')', [user.id, courseId]);
            await pool.query('UPDATE academy_courses SET enrollment_count = enrollment_count + 1 WHERE id = $1', [courseId]);
            return c.json({ success: true, message: 'Matrícula realizada com sucesso!' });
        }

        const method: PaymentMethod = useBalance ? 'balance' : (paymentMethod as PaymentMethod);
        const { total: finalCost, fee: userFee } = calculateTotalToPay(price, method);

        if (useBalance) {
            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // Deduzir saldo
                const updateRes = await updateUserBalance(client, user.id, finalCost, 'debit');
                if (!updateRes.success) throw new Error(updateRes.error);

                // Dividir valores (82.5% Autor, 7.5% Plataforma, 10% Cotistas)
                const authorAmount = price * ACADEMY_AUTHOR_SHARE;
                const platformAmount = price * ACADEMY_PLATFORM_SHARE;
                const supportersAmount = price * ACADEMY_SUPPORTERS_SHARE;

                // 1. Pagar Autor
                await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [authorAmount, course.author_id]);
                await createTransaction(client, course.author_id, 'ACADEMY_SALE', authorAmount, `Venda do curso: ${course.title}`, 'APPROVED');

                // 2. Alimentar Plataforma e Cotistas
                await client.query(`
                    UPDATE system_config SET 
                        system_balance = system_balance + $1,
                        profit_pool = profit_pool + $2
                `, [platformAmount, supportersAmount]);

                // 3. Matricular aluno
                await client.query(`
                    INSERT INTO academy_enrollments (user_id, course_id, amount_paid, payment_method, status)
                    VALUES ($1, $2, $3, 'balance', 'COMPLETED')
                `, [user.id, courseId, price]);

                await client.query('UPDATE academy_courses SET enrollment_count = enrollment_count + 1 WHERE id = $1', [courseId]);

                // 4. Registrar transação do aluno
                await createTransaction(client, user.id, 'ACADEMY_PURCHASE', finalCost, `Compra do curso: ${course.title}`, 'APPROVED');

                return { success: true };
            });

            return c.json(result);
        } else {
            // Pagamento via Gateway (Asaas)
            const external_reference = `ACADEMY_${courseId}_${user.id}_${Date.now()}`;
            let paymentData = null;

            // Buscar dados do usuário
            const userRes = await pool.query('SELECT name, email, cpf FROM users WHERE id = $1', [user.id]);
            const userData = userRes.rows[0];

            if (paymentMethod === 'card') {
                paymentData = await createCardPayment({
                    amount: finalCost,
                    description: `Curso Academia Cred30: ${course.title}`,
                    email: userData.email,
                    external_reference,
                    cpf: userData.cpf,
                    name: userData.name,
                    creditCard: body.creditCard,
                    creditCardHolderInfo: body.creditCardHolderInfo,
                    installments
                });
            } else {
                paymentData = await createPixPayment({
                    amount: finalCost,
                    description: `Curso Academia Cred30: ${course.title}`,
                    email: userData.email,
                    external_reference,
                    cpf: userData.cpf,
                    name: userData.name
                });
            }

            // Criar transação pendente
            await executeInTransaction(pool, async (client) => {
                return await createTransaction(client, user.id, 'ACADEMY_PURCHASE', finalCost, `Compra do curso: ${course.title} (Aguardando)`, 'PENDING', {
                    courseId,
                    paymentMethod,
                    external_reference,
                    asaas_id: paymentData.id
                });
            });

            return c.json({
                success: true,
                message: 'Aguardando pagamento',
                data: paymentData
            });
        }
    } catch (e: any) {
        console.error('Erro na compra de curso:', e);
        return c.json({ success: false, message: e.message }, 500);
    }
});

// Verificar se usuário tem acesso (matrícula)
educationRoutes.get('/courses/:id/access', authMiddleware, async (c) => {
    try {
        const courseId = c.req.param('id');
        const user = c.get('user');
        const pool = getDbPool(c);

        const result = await pool.query('SELECT * FROM academy_enrollments WHERE user_id = $1 AND course_id = $2 AND status = \'COMPLETED\'', [user.id, courseId]);

        return c.json({ success: true, access: result.rows.length > 0 });
    } catch (e: any) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

// Meus cursos comprados
educationRoutes.get('/my-courses', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const pool = getDbPool(c);
        const result = await pool.query(`
            SELECT c.*, u.name as author_name 
            FROM academy_courses c 
            JOIN academy_enrollments e ON c.id = e.course_id
            JOIN users u ON c.author_id = u.id
            WHERE e.user_id = $1 AND e.status = 'COMPLETED'
        `, [user.id]);
        return c.json({ success: true, data: result.rows });
    } catch (e: any) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

// Cursos criados por mim (Professor)
educationRoutes.get('/instructor/courses', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const pool = getDbPool(c);
        const result = await pool.query(`
            SELECT * FROM academy_courses WHERE author_id = $1 ORDER BY created_at DESC
        `, [user.id]);
        return c.json({ success: true, data: result.rows });
    } catch (e: any) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

export { educationRoutes };
