import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, createTransaction } from '../../../domain/services/transaction.service';
import { PoolClient } from 'pg';
import { UserContext } from '../../../shared/types/hono.types';

// Constantes do sistema de pontos
const POINTS_RATE = 1000;
const MONEY_VALUE = 0.03;

interface RewardConfig {
    id: string;
    name: string;
    pointsCost: number;
    type: 'GIFT_CARD' | 'COUPON' | 'PIX_CASHBACK' | 'MEMBERSHIP';
    value: number; // Valor em R$
}

const REWARDS_CATALOG: Record<string, RewardConfig> = {
    'gc-amazon-10': { id: 'gc-amazon-10', name: 'Gift Card Amazon R$ 10', pointsCost: 1000, type: 'GIFT_CARD', value: 10 },
    'gc-ifood-15': { id: 'gc-ifood-15', name: 'Cupom iFood R$ 15', pointsCost: 1500, type: 'COUPON', value: 15 },
    'gc-spotify-1m': { id: 'gc-spotify-1m', name: 'Spotify Premium 1 mês', pointsCost: 2000, type: 'GIFT_CARD', value: 20 },
    'gc-netflix-25': { id: 'gc-netflix-25', name: 'Gift Card Netflix R$ 25', pointsCost: 2500, type: 'GIFT_CARD', value: 25 },
    'gc-uber-20': { id: 'gc-uber-20', name: 'Crédito Uber R$ 20', pointsCost: 2000, type: 'GIFT_CARD', value: 20 },
    'gc-playstore-30': { id: 'gc-playstore-30', name: 'Google Play R$ 30', pointsCost: 3000, type: 'GIFT_CARD', value: 30 },
    'gc-recarga-10': { id: 'gc-recarga-10', name: 'Recarga Celular R$ 10', pointsCost: 1000, type: 'GIFT_CARD', value: 10 },
    'membership-pro-1m': { id: 'membership-pro-1m', name: 'PRO 1 Mês', pointsCost: 10000, type: 'MEMBERSHIP', value: 29.90 },
};

/**
 * Gera código de voucher alfanumérico
 */
function generateVoucherCode(prefix: string = 'C30'): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = prefix + '-';
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (i < 3) code += '-';
    }
    return code;
}

export class EarnController {
    /**
     * Recompensa do Baú Diário
     */
    static async chestReward(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const REWARD_POINTS = Math.floor(Math.random() * 101) + 50; // 50-150 pontos

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                const userRes = await client.query(
                    `SELECT last_reward_at, daily_chests_opened, last_chest_date, ad_points FROM users WHERE id = $1`,
                    [user.id]
                );

                const userData = userRes.rows[0];
                const lastReward = userData?.last_reward_at;
                const now = new Date();
                const today = now.toISOString().split('T')[0];
                const cooldownMs = 60 * 60 * 1000;

                let dailyChestsOpened = userData?.daily_chests_opened || 0;
                const lastChestDate = userData?.last_chest_date;

                if (lastChestDate !== today) {
                    dailyChestsOpened = 0;
                }

                if (dailyChestsOpened >= 3) {
                    throw new Error('Limite diário de baús atingido. Volte amanhã!');
                }

                if (lastReward && (now.getTime() - new Date(lastReward).getTime()) < cooldownMs) {
                    const remaining = Math.ceil((cooldownMs - (now.getTime() - new Date(lastReward).getTime())) / 60000);
                    throw new Error(`Aguarde ${remaining} minutos para abrir outro baú`);
                }

                await client.query(
                    `UPDATE users SET 
                        ad_points = COALESCE(ad_points, 0) + $1, 
                        last_reward_at = CURRENT_TIMESTAMP,
                        daily_chests_opened = $2,
                        last_chest_date = $3
                    WHERE id = $4`,
                    [REWARD_POINTS, dailyChestsOpened + 1, today, user.id]
                );

                const updatedRes = await client.query('SELECT ad_points FROM users WHERE id = $1', [user.id]);
                const newPoints = updatedRes.rows[0].ad_points || 0;

                return {
                    success: true,
                    chestsRemaining: 3 - (dailyChestsOpened + 1),
                    rewardPoints: REWARD_POINTS,
                    totalPoints: newPoints
                };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            const message = `+${result.data?.rewardPoints} pontos farm! Troque por prêmios na Loja.`;

            return c.json({
                success: true,
                message,
                chestsRemaining: result.data?.chestsRemaining,
                points: result.data?.totalPoints
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Consultar status do baú
     */
    static async getChestStatus(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const res = await pool.query(
                `SELECT last_reward_at, daily_chests_opened, last_chest_date FROM users WHERE id = $1`,
                [user.id]
            );

            const userData = res.rows[0];
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const cooldownMs = 60 * 60 * 1000;

            let dailyChestsOpened = userData?.daily_chests_opened || 0;
            if (userData?.last_chest_date !== today) {
                dailyChestsOpened = 0;
            }

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
    }

    /**
     * Recompensa de vídeo
     */
    static async videoReward(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const REWARD_POINTS = 30;

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                await client.query(
                    `UPDATE users SET ad_points = COALESCE(ad_points, 0) + $1 WHERE id = $2`,
                    [REWARD_POINTS, user.id]
                );

                const updatedRes = await client.query('SELECT ad_points FROM users WHERE id = $1', [user.id]);
                const newPoints = updatedRes.rows[0].ad_points || 0;

                return { success: true, newPoints };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            return c.json({
                success: true,
                message: `+${REWARD_POINTS} pontos farm! Troque por prêmios na Loja.`,
                points: result.data?.newPoints
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Converter pontos
     */
    /**
     * Converter pontos - DESATIVADO
     */
    static async convertPoints(c: Context) {
        return c.json({
            success: false,
            message: 'Conversão direta desativada. Use seus pontos para resgatar Gift Cards ou PRO na Loja.'
        }, 400);
    }

    /**
     * Informações de pontos
     */
    static async getPointsInfo(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const res = await pool.query('SELECT ad_points FROM users WHERE id = $1', [user.id]);
            const currentPoints = res.rows[0]?.ad_points || 0;

            const canConvert = currentPoints >= POINTS_RATE;
            const possibleConversion = Math.floor(currentPoints / POINTS_RATE) * MONEY_VALUE;
            const pointsToNextConversion = canConvert ? 0 : POINTS_RATE - currentPoints;

            return c.json({
                success: true,
                data: {
                    currentPoints,
                    canConvert,
                    possibleConversion,
                    pointsToNextConversion,
                    rate: `${POINTS_RATE} pts = R$ ${MONEY_VALUE.toFixed(2)}`
                }
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Resgatar recompensa
     */
    static async redeemReward(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();
            const { rewardId } = body;

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // 1. Buscar a recompensa no catálogo dinâmico
                const rewardRes = await client.query(
                    'SELECT * FROM reward_catalog WHERE id = $1 AND is_active = TRUE FOR SHARE',
                    [rewardId]
                );
                const reward = rewardRes.rows[0];

                if (!reward) {
                    throw new Error('Recompensa não encontrada ou inativa.');
                }

                // 2. Verificar pontos do usuário
                const userRes = await client.query('SELECT ad_points, membership_type FROM users WHERE id = $1 FOR UPDATE', [user.id]);
                const currentPoints = userRes.rows[0]?.ad_points || 0;
                const currentMembership = userRes.rows[0]?.membership_type;

                if (currentPoints < reward.points_cost) {
                    throw new Error(`Pontos insuficientes. Você tem ${currentPoints} pts, mas precisa de ${reward.points_cost} pts.`);
                }

                let deliveredCode = '';
                let deliveryMessage = '';

                // 3. Lógica específica por tipo
                if (reward.type === 'GIFT_CARD' || reward.type === 'COUPON') {
                    // Buscar código disponível no estoque
                    const codeRes = await client.query(
                        'SELECT id, code FROM reward_inventory WHERE reward_id = $1 AND is_used = FALSE LIMIT 1 FOR UPDATE SKIP LOCKED',
                        [rewardId]
                    );

                    if (codeRes.rows.length === 0) {
                        throw new Error('Estoque esgotado para este prêmio. Tente novamente mais tarde ou escolha outro.');
                    }

                    const inventoryItem = codeRes.rows[0];
                    deliveredCode = inventoryItem.code;

                    // Marcar código como usado
                    await client.query(
                        'UPDATE reward_inventory SET is_used = TRUE, used_by_user_id = $1, used_at = NOW() WHERE id = $2',
                        [user.id, inventoryItem.id]
                    );

                    deliveryMessage = `Resgate realizado! Seu código: ${deliveredCode}.`;
                } else if (reward.type === 'MEMBERSHIP') {
                    if (currentMembership === 'PRO') {
                        await client.query(
                            `UPDATE users SET pro_expires_at = COALESCE(pro_expires_at, NOW()) + INTERVAL '30 days' WHERE id = $1`,
                            [user.id]
                        );
                        deliveryMessage = 'Seu plano PRO foi estendido por mais 30 dias!';
                    } else {
                        await client.query(
                            `UPDATE users SET membership_type = 'PRO', pro_expires_at = NOW() + INTERVAL '30 days' WHERE id = $1`,
                            [user.id]
                        );
                        deliveryMessage = 'Você agora é Cred30 PRO por 30 dias!';
                    }
                    deliveredCode = `PRO-${Date.now()}`;
                } else {
                    throw new Error('Tipo de recompensa não suportado.');
                }

                // 4. Deduzir pontos
                const newPoints = currentPoints - reward.points_cost;
                await client.query('UPDATE users SET ad_points = $1 WHERE id = $2', [newPoints, user.id]);

                // 5. Registrar no histórico
                await client.query(
                    `INSERT INTO reward_redemptions (user_id, reward_id, reward_name, points_spent, code_delivered, status, created_at)
                     VALUES ($1, $2, $3, $4, $5, 'COMPLETED', NOW())`,
                    [user.id, reward.id, reward.name, reward.points_cost, deliveredCode]
                );

                return { success: true, code: deliveredCode, deliveryMessage, newPoints };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            return c.json({
                success: true,
                message: result.data?.deliveryMessage,
                code: result.data?.code,
                pointsRemaining: result.data?.newPoints
            });

        } catch (error: any) {
            console.error('[REWARDS] Erro ao resgatar:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Catálogo de recompensas
     */
    static async getRewardsCatalog(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const userRes = await pool.query('SELECT ad_points FROM users WHERE id = $1', [user.id]);
            const currentPoints = userRes.rows[0]?.ad_points || 0;

            const res = await pool.query(`
                SELECT c.*, 
                (SELECT COUNT(*) FROM reward_inventory i WHERE i.reward_id = c.id AND i.is_used = FALSE) as stock
                FROM reward_catalog c
                WHERE is_active = TRUE
                ORDER BY points_cost ASC
            `);

            const catalog = res.rows.map(r => ({
                id: r.id,
                name: r.name,
                pointsCost: r.points_cost,
                type: r.type,
                value: parseFloat(r.value),
                stock: parseInt(r.stock),
                image_url: r.image_url,
                canAfford: currentPoints >= r.points_cost
            }));

            console.log('[EarnController] Catálogo de recompensas enviado:', catalog);

            return c.json({
                success: true,
                data: {
                    currentPoints,
                    catalog
                }
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
