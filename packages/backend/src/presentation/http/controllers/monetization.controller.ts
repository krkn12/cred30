import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { PoolClient } from 'pg';
import { executeInTransaction, createTransaction } from '../../../domain/services/transaction.service';
import { updateScore } from '../../../application/services/score.service';
import {
    VERIFIED_BADGE_PRICE,
    SCORE_BOOST_PRICE,
    SCORE_BOOST_POINTS,
    REPUTATION_CHECK_PRICE,
    MUTUAL_PROTECTION_PRICE
} from '../../../shared/constants/business.constants';
import { UserContext } from '../../../shared/types/hono.types';
import {
    VALUE_PER_1000_POINTS,
    MIN_POINTS_FOR_CONVERSION
} from '../../../application/services/points.service';

const PRO_UPGRADE_FEE = 29.90;

const upgradeProSchema = z.object({
    method: z.enum(['balance', 'pix', 'card']).default('balance'),
    installments: z.number().optional()
});

/**
 * Função auxiliar para verificar e converter pontos automaticamente
 */
async function autoConvertPoints(client: PoolClient, userId: string | number): Promise<{ converted: boolean; pointsConverted: number; moneyCredited: number; remainingPoints: number }> {
    const userRes = await client.query('SELECT ad_points, balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const currentPoints = Math.floor(userRes.rows[0].ad_points || 0);

    // Usa constante global (atualmente 1000)
    if (currentPoints < MIN_POINTS_FOR_CONVERSION) {
        return { converted: false, pointsConverted: 0, moneyCredited: 0, remainingPoints: currentPoints };
    }

    const lots = Math.floor(currentPoints / MIN_POINTS_FOR_CONVERSION);
    const pointsToConvert = lots * MIN_POINTS_FOR_CONVERSION; // Ex: 1000, 2000...

    // Nova regra: (Pontos / 1000) * 0.07
    const moneyToCredit = (pointsToConvert / 1000) * VALUE_PER_1000_POINTS;

    const remainingPoints = currentPoints - pointsToConvert;

    const systemRes = await client.query('SELECT system_balance FROM system_config LIMIT 1 FOR UPDATE');
    const systemBalance = parseFloat(systemRes.rows[0]?.system_balance || '0');

    if (systemBalance < moneyToCredit) {
        console.warn(`[POINTS] Caixa insuficiente para conversão. Caixa: ${systemBalance}, Necessário: ${moneyToCredit}`);
        return { converted: false, pointsConverted: 0, moneyCredited: 0, remainingPoints: currentPoints };
    }

    await client.query(`UPDATE system_config SET system_balance = system_balance - $1`, [moneyToCredit]);
    await client.query(`UPDATE users SET ad_points = $1, balance = balance + $2 WHERE id = $3`, [remainingPoints, moneyToCredit, userId]);

    await createTransaction(
        client,
        String(userId),
        'BONUS',
        moneyToCredit,
        `🎉 Conversão Automática: ${pointsToConvert} pontos`,
        'APPROVED'
    );

    return { converted: true, pointsConverted: pointsToConvert, moneyCredited: moneyToCredit, remainingPoints };
}

export class MonetizationController {
    /**
     * Recompensa de vídeo
     */
    static async rewardVideo(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const REWARD_POINTS = 50;
            const REWARD_SCORE = 5;
            const COOLDOWN_MINUTES = 10;

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // LOCK USER: Previne farming simultâneo (abrir 10 abas e clicar ao mesmo tempo)
                const userRes = await client.query('SELECT last_reward_at, score, ad_points FROM users WHERE id = $1 FOR UPDATE', [user.id]);
                const lastReward = userRes.rows[0].last_reward_at;

                if (lastReward) {
                    const diff = (Date.now() - new Date(lastReward).getTime()) / (1000 * 60);
                    if (diff < COOLDOWN_MINUTES) {
                        throw new Error(`Aguarde mais ${Math.ceil(COOLDOWN_MINUTES - diff)} minutos para o próximo vídeo.`);
                    }
                }

                await client.query(
                    'UPDATE users SET last_reward_at = NOW() WHERE id = $1',
                    [user.id]
                );

                await PointsService.addPoints(client, user.id, REWARD_POINTS, 'Recompensa de Vídeo (Extra)');

                const conversion = await autoConvertPoints(client, user.id);
                const updatedRes = await client.query('SELECT ad_points FROM users WHERE id = $1', [user.id]);
                const newPoints = updatedRes.rows[0].ad_points || 0;

                return { success: true, newPoints, conversion };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);

            const conversion = result.data?.conversion;
            let message = `+${REWARD_POINTS} pontos farm e +${REWARD_SCORE} Score!`;

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
    }

    /**
     * Upgrade PRO
     */
    static async upgradePro(c: Context) {
        try {
            const body = await c.req.json();
            const { method } = upgradeProSchema.parse(body);

            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            // Adicionar transação para leitura segura
            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                const userCheck = await client.query('SELECT membership_type, balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
                if (method !== 'balance') {
                    throw new Error('Pagamentos PIX/Cartão externos estão temporariamente indisponíveis.');
                }

                // Lógica movida para dentro do executeInTransaction principal para manter o LOCK
                // const result = await executeInTransaction... ( removido aninhamento desnecessário se já estamos em tx, ou adaptar)

                // Na verdade, o código original abria uma tx na linha 149.
                // Como agora abri na linha 137 (virtualmente), preciso ajustar a estrutura.
                // O código original fazia check fora da tx, e depois abria tx.
                // Vou manter a tx iniciando na 149, mas adicionar o lock logo no inicio dela.

                // RESETANDO bloco incorreto acima para editar corretamente.
                // O bloco anterior (chunk 2) tentou envolver tudo em tx.
                // Melhor abordagem: Deixar o userCheck original (leitura suja rápida) E adicionar lock dentro da tx existente.
                if (parseFloat(userCheck.rows[0].balance) < PRO_UPGRADE_FEE) {
                    throw new Error('Saldo insuficiente para o upgrade PRO.');
                }

                await client.query('UPDATE users SET balance = balance - $1, membership_type = $2 WHERE id = $3', [PRO_UPGRADE_FEE, 'PRO', user.id]);

                // REGRA 80/20: 80% Cotistas, 20% Sistema
                const feeForProfit = PRO_UPGRADE_FEE * 0.80;
                const feeForReserves = PRO_UPGRADE_FEE * 0.20;

                // Dividir a parte do sistema (20%) em 4 partes iguais (5% do total cada)
                const reserveShare = feeForReserves * 0.25;

                await client.query(
                    `UPDATE system_config SET 
                        profit_pool = profit_pool + $1,
                        total_tax_reserve = total_tax_reserve + $2,
                        total_operational_reserve = total_operational_reserve + $3,
                        total_owner_profit = total_owner_profit + $4,
                        investment_reserve = investment_reserve + $5`,
                    [feeForProfit, reserveShare, reserveShare, reserveShare, reserveShare]
                );

                await createTransaction(
                    client,
                    user.id,
                    'MEMBERSHIP_UPGRADE',
                    -PRO_UPGRADE_FEE,
                    'Upgrade para Plano Cred30 PRO (Saldo)',
                    'APPROVED'
                );

                return { success: true };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);
            return c.json({ success: true, message: 'Parabéns! Agora você é um MEMBRO PRO!' });

        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Comprar selo de verificado
     */
    static async buyVerifiedBadge(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                const userRes = await client.query('SELECT is_verified, balance FROM users WHERE id = $1', [user.id]);
                if (userRes.rows[0].is_verified) {
                    throw new Error('Você já possui o Selo de Verificado!');
                }

                if (parseFloat(userRes.rows[0].balance) < VERIFIED_BADGE_PRICE) {
                    throw new Error(`Saldo insuficiente. Necessário R$ ${VERIFIED_BADGE_PRICE.toFixed(2)}.`);
                }

                await client.query('UPDATE users SET balance = balance - $1, is_verified = TRUE WHERE id = $2', [VERIFIED_BADGE_PRICE, user.id]);
                await updateScore(client, user.id, 100, 'Compra de Selo de Verificado (Confiança)');

                const feeForProfit = VERIFIED_BADGE_PRICE * 0.80;
                const feeForReserves = VERIFIED_BADGE_PRICE * 0.20;

                await client.query(
                    `UPDATE system_config SET 
                        profit_pool = profit_pool + $1,
                        total_tax_reserve = total_tax_reserve + $2,
                        total_operational_reserve = total_operational_reserve + $3,
                        total_owner_profit = total_owner_profit + $4,
                        investment_reserve = investment_reserve + $5`,
                    [feeForProfit, feeForReserves * 0.25, feeForReserves * 0.25, feeForReserves * 0.25, feeForReserves * 0.25]
                );

                await createTransaction(
                    client,
                    user.id,
                    'PREMIUM_PURCHASE',
                    -VERIFIED_BADGE_PRICE,
                    'Compra de Selo de Verificado',
                    'APPROVED'
                );

                return { success: true };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);
            return c.json({ success: true, message: 'Selo de Verificado Adquirido!' });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Comprar Boost de Score
     */
    static async buyScoreBoost(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [user.id]);

                if (parseFloat(userRes.rows[0].balance) < SCORE_BOOST_PRICE) {
                    throw new Error(`Saldo insuficiente. Necessário R$ ${SCORE_BOOST_PRICE.toFixed(2)}.`);
                }

                await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [SCORE_BOOST_PRICE, user.id]);
                await updateScore(client, user.id, SCORE_BOOST_POINTS, 'Compra de Pacote Score Boost');

                const feeForProfit = SCORE_BOOST_PRICE * 0.80;
                const feeForReserves = SCORE_BOOST_PRICE * 0.20;

                await client.query(
                    `UPDATE system_config SET 
                        profit_pool = profit_pool + $1,
                        total_tax_reserve = total_tax_reserve + $2,
                        total_operational_reserve = total_operational_reserve + $3,
                        total_owner_profit = total_owner_profit + $4,
                        investment_reserve = investment_reserve + $5`,
                    [feeForProfit, feeForReserves * 0.25, feeForReserves * 0.25, feeForReserves * 0.25, feeForReserves * 0.25]
                );

                await createTransaction(
                    client,
                    user.id,
                    'PREMIUM_PURCHASE',
                    -SCORE_BOOST_PRICE,
                    'Compra de Pacote Score Boost (+100)',
                    'APPROVED'
                );

                return { success: true };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);
            return c.json({ success: true, message: `Boost Ativado! +${SCORE_BOOST_POINTS} pontos de Score.` });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Check-in diário
     */
    static async dailyCheckin(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const CHECKIN_POINTS = 100;
            const CHECKIN_SCORE = 10;

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // LOCK USER: Previne check-in duplo
                const userRes = await client.query('SELECT last_checkin_at, ad_points FROM users WHERE id = $1 FOR UPDATE', [user.id]);
                const lastCheckin = userRes.rows[0].last_checkin_at;

                if (lastCheckin) {
                    const lastDate = new Date(lastCheckin).toLocaleDateString();
                    const today = new Date().toLocaleDateString();
                    if (lastDate === today) {
                        throw new Error('Você já realizou o check-in de hoje!');
                    }
                }

                await client.query(
                    'UPDATE users SET last_checkin_at = NOW() WHERE id = $1',
                    [user.id]
                );

                await PointsService.addPoints(client, user.id, CHECKIN_POINTS, 'Check-in Diário');

                const conversion = await autoConvertPoints(client, user.id);
                const updatedRes = await client.query('SELECT ad_points FROM users WHERE id = $1', [user.id]);
                const newPoints = updatedRes.rows[0].ad_points || 0;

                return { success: true, newPoints, conversion };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);

            const conversion = result.data?.conversion;
            let message = `Check-in realizado! +${CHECKIN_POINTS} pontos farm e +${CHECKIN_SCORE} Score.`;

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
    }

    /**
     * Consulta de reputação
     */
    static async reputationCheck(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const targetEmail = c.req.param('email').toLowerCase().trim();
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
                if (parseFloat(userRes.rows[0].balance) < REPUTATION_CHECK_PRICE) {
                    throw new Error(`Saldo insuficiente. A consulta custa R$ ${REPUTATION_CHECK_PRICE.toFixed(2)}.`);
                }

                // FIX: Debit the user's balance!
                await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [REPUTATION_CHECK_PRICE, user.id]);

                const targetRes = await client.query(
                    'SELECT name, score, is_verified, membership_type, created_at, status FROM users WHERE email = $1',
                    [targetEmail]
                );

                if (targetRes.rows.length === 0) {
                    throw new Error('Nenhum associado encontrado.');
                }

                const target = targetRes.rows[0];

                const feeForProfit = REPUTATION_CHECK_PRICE * 0.80;
                const feeForReserves = REPUTATION_CHECK_PRICE * 0.20;

                await client.query(
                    `UPDATE system_config SET 
                        profit_pool = profit_pool + $1,
                        total_tax_reserve = total_tax_reserve + $2,
                        total_operational_reserve = total_operational_reserve + $3,
                        total_owner_profit = total_owner_profit + $4,
                        investment_reserve = investment_reserve + $5`,
                    [feeForProfit, feeForReserves * 0.25, feeForReserves * 0.25, feeForReserves * 0.25, feeForReserves * 0.25]
                );

                await createTransaction(
                    client,
                    user.id,
                    'REPUTATION_CONSULT',
                    -REPUTATION_CHECK_PRICE,
                    `Consulta de Idoneidade: ${targetEmail}`,
                    'APPROVED'
                );

                return {
                    name: target.name,
                    score: target.score,
                    isVerified: target.is_verified,
                    membership: target.membership_type,
                    since: target.created_at,
                    status: target.status
                };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);

            return c.json({
                success: true,
                message: 'Consulta realizada com sucesso!',
                data: result.data
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Comprar Proteção Mútua (Seguro Social)
     */
    static async buyProtection(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
                if (parseFloat(userRes.rows[0].balance) < MUTUAL_PROTECTION_PRICE) {
                    throw new Error(`Saldo insuficiente. A proteção mensal custa R$ ${MUTUAL_PROTECTION_PRICE.toFixed(2)}.`);
                }

                // Debita o saldo
                await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [MUTUAL_PROTECTION_PRICE, user.id]);

                // Ativa proteção (+30 dias)
                const protectionExpiry = new Date();
                protectionExpiry.setDate(protectionExpiry.getDate() + 30);

                await client.query(
                    'UPDATE users SET is_protected = TRUE, protection_expires_at = $1 WHERE id = $2',
                    [protectionExpiry, user.id]
                );

                // Incrementa o fundo de proteção (Regra 80/20)
                const fundShare = MUTUAL_PROTECTION_PRICE * 0.80;
                const systemShare = MUTUAL_PROTECTION_PRICE * 0.20;

                await client.query(
                    `UPDATE system_config SET 
                        mutual_protection_fund = mutual_protection_fund + $1,
                        total_tax_reserve = total_tax_reserve + $2,
                        total_operational_reserve = total_operational_reserve + $2,
                        total_owner_profit = total_owner_profit + $2,
                        investment_reserve = investment_reserve + $2`,
                    [fundShare, systemShare * 0.25]
                );

                // Ganho de Score por segurança
                await updateScore(client, user.id, 50, 'Ativação de Proteção Mútua (Prevenção)');

                await createTransaction(
                    client,
                    user.id,
                    'PROTECTION_PURCHASE',
                    -MUTUAL_PROTECTION_PRICE,
                    'Ativação de Proteção Mútua (Mensal)',
                    'APPROVED'
                );

                return { success: true, expiry: protectionExpiry };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);

            return c.json({
                success: true,
                message: 'Você agora é um Membro Protegido!',
                expiry: result.data?.expiry
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
