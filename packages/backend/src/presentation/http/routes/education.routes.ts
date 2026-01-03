import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction } from '../../../domain/services/transaction.service';
import { PoolClient } from 'pg';
import { updateScore } from '../../../application/services/score.service';

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

export { educationRoutes };
