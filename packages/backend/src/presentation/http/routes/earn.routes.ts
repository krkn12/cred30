import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, createTransaction } from '../../../domain/services/transaction.service';
import { PoolClient } from 'pg';

export const earnRoutes = new Hono();

/**
 * Recompensa do Baú Diário (Chest Reward)
 * O usuário assiste anúncio e ganha pequena recompensa
 */
earnRoutes.post('/chest-reward', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const { amount } = body;

        // Validar valor (máximo R$ 0,05 por baú para ser sustentável)
        const rewardAmount = Math.min(parseFloat(amount) || 0.01, 0.05);

        if (rewardAmount <= 0) {
            return c.json({ success: false, message: 'Valor inválido' }, 400);
        }

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // Buscar dados do usuário
            const userRes = await client.query(
                `SELECT last_reward_at, daily_chests_opened, last_chest_date, balance FROM users WHERE id = $1`,
                [user.id]
            );

            const userData = userRes.rows[0];
            const lastReward = userData?.last_reward_at;
            const now = new Date();
            const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const cooldownMs = 60 * 60 * 1000; // 1 hora

            // Reset diário: se é um novo dia, resetar contador
            let dailyChestsOpened = userData?.daily_chests_opened || 0;
            const lastChestDate = userData?.last_chest_date;

            if (lastChestDate !== today) {
                dailyChestsOpened = 0;
            }

            // Verificar limite diário (máximo 3 baús por dia)
            if (dailyChestsOpened >= 3) {
                throw new Error('Limite diário de baús atingido. Volte amanhã!');
            }

            // Verificar cooldown (1 hora entre baús)
            if (lastReward && (now.getTime() - new Date(lastReward).getTime()) < cooldownMs) {
                const remaining = Math.ceil((cooldownMs - (now.getTime() - new Date(lastReward).getTime())) / 60000);
                throw new Error(`Aguarde ${remaining} minutos para abrir outro baú`);
            }

            // Creditar recompensa e atualizar contadores
            await client.query(
                `UPDATE users SET 
                    balance = balance + $1, 
                    last_reward_at = CURRENT_TIMESTAMP,
                    daily_chests_opened = $2,
                    last_chest_date = $3
                WHERE id = $4`,
                [rewardAmount, dailyChestsOpened + 1, today, user.id]
            );

            // Registrar transação
            await createTransaction(
                client,
                user.id,
                'BONUS',
                rewardAmount,
                `Baú de Fidelidade Aberto`,
                'APPROVED'
            );

            return {
                success: true,
                chestsRemaining: 3 - (dailyChestsOpened + 1),
                rewardAmount
            };
        });

        if (!result.success) {
            return c.json({ success: false, message: result.error }, 400);
        }

        return c.json({
            success: true,
            message: `Você recebeu R$ ${result.data?.rewardAmount?.toFixed(2) || '0.01'} do Baú de Fidelidade!`,
            chestsRemaining: result.data?.chestsRemaining ?? 0
        });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

/**
 * Consultar status do baú (quantidade restante e cooldown)
 */
earnRoutes.get('/chest-status', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const res = await pool.query(
            `SELECT last_reward_at, daily_chests_opened, last_chest_date FROM users WHERE id = $1`,
            [user.id]
        );

        const userData = res.rows[0];
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const cooldownMs = 60 * 60 * 1000;

        // Reset diário
        let dailyChestsOpened = userData?.daily_chests_opened || 0;
        if (userData?.last_chest_date !== today) {
            dailyChestsOpened = 0;
        }

        // Calcular countdown
        let countdown = 0;
        if (userData?.last_reward_at) {
            const elapsed = now.getTime() - new Date(userData.last_reward_at).getTime();
            countdown = Math.max(0, Math.ceil((cooldownMs - elapsed) / 1000));
        }

        return c.json({
            success: true,
            chestsRemaining: Math.max(0, 3 - dailyChestsOpened),
            countdown,
            canOpen: dailyChestsOpened < 3 && countdown === 0
        });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

/**
 * Recompensa por assistir vídeo promocional
 */
earnRoutes.post('/video-reward', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);
        const body = await c.req.json();
        const { videoId } = body;

        const REWARD_AMOUNT = 0.002; // R$ 0,002 por vídeo

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // Creditar recompensa
            await client.query(
                `UPDATE users SET balance = balance + $1 WHERE id = $2`,
                [REWARD_AMOUNT, user.id]
            );

            // Registrar transação
            await createTransaction(
                client,
                user.id,
                'BONUS',
                REWARD_AMOUNT,
                `Recompensa por vídeo assistido`,
                'APPROVED'
            );

            return { success: true };
        });

        if (!result.success) {
            return c.json({ success: false, message: result.error }, 400);
        }

        return c.json({ success: true, message: `Bônus de R$ ${REWARD_AMOUNT.toFixed(3)} recebido!` });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});
