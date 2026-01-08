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
    'pix-5': { id: 'pix-5', name: 'PIX R$ 5', pointsCost: 5000, type: 'PIX_CASHBACK', value: 5 },
    'pix-10': { id: 'pix-10', name: 'PIX R$ 10', pointsCost: 9000, type: 'PIX_CASHBACK', value: 10 },
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
    static async convertPoints(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                const userRes = await client.query('SELECT ad_points, balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
                const currentPoints = userRes.rows[0].ad_points || 0;

                if (currentPoints < POINTS_RATE) {
                    throw new Error(`Você precisa de no mínimo ${POINTS_RATE} pontos para converter. Atual: ${currentPoints}`);
                }

                const lots = Math.floor(currentPoints / POINTS_RATE);
                const pointsToConvert = lots * POINTS_RATE;
                const moneyToCredit = lots * MONEY_VALUE;
                const remainingPoints = currentPoints - pointsToConvert;

                const systemRes = await client.query('SELECT system_balance FROM system_config LIMIT 1 FOR UPDATE');
                const systemBalance = parseFloat(systemRes.rows[0]?.system_balance || '0');

                if (systemBalance < moneyToCredit) {
                    throw new Error(`Caixa insuficiente para conversão. Tente novamente mais tarde.`);
                }

                await client.query(`UPDATE system_config SET system_balance = system_balance - $1`, [moneyToCredit]);
                await client.query(`UPDATE users SET ad_points = $1, balance = balance + $2 WHERE id = $3`, [remainingPoints, moneyToCredit, user.id]);

                await createTransaction(
                    client,
                    user.id,
                    'BONUS',
                    moneyToCredit,
                    `Conversão: ${pointsToConvert} pontos farm`,
                    'APPROVED'
                );

                return {
                    success: true,
                    pointsConverted: pointsToConvert,
                    moneyCredited: moneyToCredit,
                    remainingPoints
                };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            return c.json({
                success: true,
                message: `Convertido! ${result.data?.pointsConverted} pontos = R$ ${result.data?.moneyCredited?.toFixed(2)}`,
                data: result.data
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
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
            const { rewardId, pointsCost: clientPointsCost } = body;

            const reward = REWARDS_CATALOG[rewardId];
            if (!reward) {
                return c.json({ success: false, message: 'Recompensa não encontrada.' }, 404);
            }

            if (clientPointsCost !== reward.pointsCost) {
                return c.json({ success: false, message: 'Custo de pontos inválido.' }, 400);
            }

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                const userRes = await client.query('SELECT ad_points, balance, membership_type FROM users WHERE id = $1 FOR UPDATE', [user.id]);
                const currentPoints = userRes.rows[0]?.ad_points || 0;
                const currentMembership = userRes.rows[0]?.membership_type;

                if (currentPoints < reward.pointsCost) {
                    throw new Error(`Pontos insuficientes. Você tem ${currentPoints} pts, mas precisa de ${reward.pointsCost} pts.`);
                }

                const newPoints = currentPoints - reward.pointsCost;
                await client.query('UPDATE users SET ad_points = $1 WHERE id = $2', [newPoints, user.id]);

                let code = '';
                let deliveryMessage = '';

                switch (reward.type) {
                    case 'GIFT_CARD':
                    case 'COUPON':
                        code = generateVoucherCode(reward.type === 'GIFT_CARD' ? 'GC' : 'CP');
                        deliveryMessage = `Seu código: ${code}. Anote em local seguro!`;

                        await client.query(
                            `INSERT INTO reward_redemptions (user_id, reward_id, reward_name, points_spent, code, status, created_at)
                             VALUES ($1, $2, $3, $4, $5, 'PENDING_DELIVERY', NOW())`
                        ).catch(() => {
                            console.log('[REWARDS] Tabela reward_redemptions não existe, continuando sem log');
                        });
                        break;

                    case 'PIX_CASHBACK':
                        const systemRes = await client.query('SELECT system_balance FROM system_config LIMIT 1 FOR UPDATE');
                        const systemBalance = parseFloat(systemRes.rows[0]?.system_balance || '0');

                        if (systemBalance < reward.value) {
                            throw new Error('Caixa operacional insuficiente. Tente outra recompensa.');
                        }

                        await client.query('UPDATE system_config SET system_balance = system_balance - $1', [reward.value]);
                        await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [reward.value, user.id]);

                        await createTransaction(
                            client,
                            String(user.id),
                            'BONUS',
                            reward.value,
                            `🎁 Resgate: ${reward.name}`,
                            'APPROVED'
                        );

                        code = `PIX-${Date.now()}`;
                        deliveryMessage = `R$ ${reward.value.toFixed(2)} creditados no seu saldo!`;
                        break;

                    case 'MEMBERSHIP':
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
                        code = `PRO-${Date.now()}`;
                        break;
                }

                return { success: true, code, deliveryMessage, newPoints };
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

            const res = await pool.query('SELECT ad_points FROM users WHERE id = $1', [user.id]);
            const currentPoints = res.rows[0]?.ad_points || 0;

            const catalog = Object.values(REWARDS_CATALOG).map(r => ({
                ...r,
                canAfford: currentPoints >= r.pointsCost
            }));

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
