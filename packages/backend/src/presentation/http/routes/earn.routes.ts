import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, createTransaction } from '../../../domain/services/transaction.service';
import { PoolClient } from 'pg';

export const earnRoutes = new Hono();

// Constantes do sistema de pontos
const POINTS_RATE = 1000; // 1000 pontos
const MONEY_VALUE = 0.03; // = R$ 0,03

/**
 * Função auxiliar para verificar e converter pontos automaticamente
 * O dinheiro sai do system_balance (caixa operacional alimentado por ads)
 * Retorna o valor convertido se houve conversão, ou 0 se não
 */
async function autoConvertPoints(client: PoolClient, userId: string | number): Promise<{ converted: boolean; pointsConverted: number; moneyCredited: number; remainingPoints: number }> {
    // Buscar pontos atuais
    const userRes = await client.query('SELECT ad_points, balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const currentPoints = userRes.rows[0].ad_points || 0;

    if (currentPoints < POINTS_RATE) {
        return { converted: false, pointsConverted: 0, moneyCredited: 0, remainingPoints: currentPoints };
    }

    // Calcular quantos lotes de 1000 pontos
    const lots = Math.floor(currentPoints / POINTS_RATE);
    const pointsToConvert = lots * POINTS_RATE;
    const moneyToCredit = lots * MONEY_VALUE;
    const remainingPoints = currentPoints - pointsToConvert;

    // Verificar se há saldo suficiente no caixa operacional
    const systemRes = await client.query('SELECT system_balance FROM system_config LIMIT 1 FOR UPDATE');
    const systemBalance = parseFloat(systemRes.rows[0]?.system_balance || '0');

    if (systemBalance < moneyToCredit) {
        // Não há saldo no caixa - não converte (evita criar dinheiro do nada)
        console.warn(`[POINTS] Caixa insuficiente para conversão. Caixa: ${systemBalance}, Necessário: ${moneyToCredit}`);
        return { converted: false, pointsConverted: 0, moneyCredited: 0, remainingPoints: currentPoints };
    }

    // 1. Descontar do caixa operacional (system_balance)
    await client.query(
        `UPDATE system_config SET system_balance = system_balance - $1`,
        [moneyToCredit]
    );

    // 2. Creditar no saldo do usuário e zerar os pontos convertidos
    await client.query(
        `UPDATE users SET ad_points = $1, balance = balance + $2 WHERE id = $3`,
        [remainingPoints, moneyToCredit, userId]
    );

    // 3. Registrar transação
    await createTransaction(
        client,
        String(userId),
        'BONUS',
        moneyToCredit,
        `🎉 Conversão: ${pointsToConvert} pontos farm`,
        'APPROVED'
    );

    return { converted: true, pointsConverted: pointsToConvert, moneyCredited: moneyToCredit, remainingPoints };
}

/**
 * Recompensa do Baú Diário (Chest Reward)
 * O usuário assiste anúncio e ganha pontos farm
 * 1000 pontos = R$ 0,03 (conversão automática!)
 */
earnRoutes.post('/chest-reward', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        // Sistema de Pontos: 1000 pts = R$ 0,03
        // Cada baú dá entre 50-150 pontos (aleatório)
        const REWARD_POINTS = Math.floor(Math.random() * 101) + 50; // 50-150 pontos

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // Buscar dados do usuário
            const userRes = await client.query(
                `SELECT last_reward_at, daily_chests_opened, last_chest_date, ad_points FROM users WHERE id = $1`,
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

            // Creditar PONTOS
            await client.query(
                `UPDATE users SET 
                    ad_points = COALESCE(ad_points, 0) + $1, 
                    last_reward_at = CURRENT_TIMESTAMP,
                    daily_chests_opened = $2,
                    last_chest_date = $3
                WHERE id = $4`,
                [REWARD_POINTS, dailyChestsOpened + 1, today, user.id]
            );

            // Verificar e converter automaticamente se atingiu 1000 pontos
            const conversion = await autoConvertPoints(client, user.id);

            // Buscar pontos atualizados
            const updatedRes = await client.query('SELECT ad_points FROM users WHERE id = $1', [user.id]);
            const newPoints = updatedRes.rows[0].ad_points || 0;

            return {
                success: true,
                chestsRemaining: 3 - (dailyChestsOpened + 1),
                rewardPoints: REWARD_POINTS,
                totalPoints: newPoints,
                conversion
            };
        });

        if (!result.success) {
            return c.json({ success: false, message: result.error }, 400);
        }

        const conversion = result.data?.conversion;
        let message = `+${result.data?.rewardPoints || 50} pontos farm!`;

        if (conversion?.converted) {
            message += ` 🎉 +R$ ${conversion.moneyCredited.toFixed(2)} convertidos automaticamente!`;
        }

        return c.json({
            success: true,
            message,
            chestsRemaining: result.data?.chestsRemaining ?? 0,
            points: result.data?.totalPoints || 0,
            conversion: conversion?.converted ? {
                moneyCredited: conversion.moneyCredited,
                pointsConverted: conversion.pointsConverted
            } : null
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
 * Sistema de Pontos: 1000 pts = R$ 0,03 (conversão automática!)
 */
earnRoutes.post('/video-reward', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const REWARD_POINTS = 30; // 30 pontos por vídeo promocional

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // Creditar PONTOS
            await client.query(
                `UPDATE users SET ad_points = COALESCE(ad_points, 0) + $1 WHERE id = $2`,
                [REWARD_POINTS, user.id]
            );

            // Verificar e converter automaticamente se atingiu 1000 pontos
            const conversion = await autoConvertPoints(client, user.id);

            // Buscar pontos atualizados
            const updatedRes = await client.query('SELECT ad_points FROM users WHERE id = $1', [user.id]);
            const newPoints = updatedRes.rows[0].ad_points || 0;

            return { success: true, newPoints, conversion };
        });

        if (!result.success) {
            return c.json({ success: false, message: result.error }, 400);
        }

        const conversion = result.data?.conversion;
        let message = `+${REWARD_POINTS} pontos farm!`;

        if (conversion?.converted) {
            message += ` 🎉 +R$ ${conversion.moneyCredited.toFixed(2)} convertidos!`;
        }

        return c.json({
            success: true,
            message,
            points: result.data?.newPoints || 0,
            conversion: conversion?.converted ? {
                moneyCredited: conversion.moneyCredited,
                pointsConverted: conversion.pointsConverted
            } : null
        });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

/**
 * Converter Pontos Farm para Saldo
 * Taxa: 1000 pontos = R$ 0,03
 * O dinheiro sai do system_balance (caixa operacional)
 */
earnRoutes.post('/convert-points', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // Buscar pontos atuais
            const userRes = await client.query('SELECT ad_points, balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
            const currentPoints = userRes.rows[0].ad_points || 0;

            if (currentPoints < POINTS_RATE) {
                throw new Error(`Você precisa de no mínimo ${POINTS_RATE} pontos para converter. Atual: ${currentPoints}`);
            }

            // Calcular quantos lotes de 1000 pontos
            const lots = Math.floor(currentPoints / POINTS_RATE);
            const pointsToConvert = lots * POINTS_RATE;
            const moneyToCredit = lots * MONEY_VALUE;
            const remainingPoints = currentPoints - pointsToConvert;

            // Verificar se há saldo suficiente no caixa operacional
            const systemRes = await client.query('SELECT system_balance FROM system_config LIMIT 1 FOR UPDATE');
            const systemBalance = parseFloat(systemRes.rows[0]?.system_balance || '0');

            if (systemBalance < moneyToCredit) {
                throw new Error(`Caixa insuficiente para conversão. Tente novamente mais tarde.`);
            }

            // 1. Descontar do caixa operacional
            await client.query(
                `UPDATE system_config SET system_balance = system_balance - $1`,
                [moneyToCredit]
            );

            // 2. Creditar no usuário
            await client.query(
                `UPDATE users SET ad_points = $1, balance = balance + $2 WHERE id = $3`,
                [remainingPoints, moneyToCredit, user.id]
            );

            // 3. Registrar transação
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
});

/**
 * Obter informações de pontos do usuário
 */
earnRoutes.get('/points-info', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as any;
        const pool = getDbPool(c);

        const res = await pool.query('SELECT ad_points FROM users WHERE id = $1', [user.id]);
        const currentPoints = res.rows[0]?.ad_points || 0;

        const POINTS_RATE = 1000;
        const MONEY_VALUE = 0.03;

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
});
