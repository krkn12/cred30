import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';
import { PoolClient } from 'pg';
import { executeInTransaction, createTransaction } from '../../../domain/services/transaction.service';
import { z } from 'zod';
import { calculateTotalToPay, PaymentMethod } from '../../../shared/utils/financial.utils';
import { createPixPayment, createCardPayment } from '../../../infrastructure/gateways/asaas.service';
import { updateScore } from '../../../application/services/score.service';
import { VERIFIED_BADGE_PRICE, SCORE_BOOST_PRICE, SCORE_BOOST_POINTS, REPUTATION_CHECK_PRICE, USE_ASAAS, ADMIN_PIX_KEY } from '../../../shared/constants/business.constants';

const monetizationRoutes = new Hono();

const PRO_UPGRADE_FEE = 29.90;

const cardDataSchema = {
    creditCard: z.object({
        holderName: z.string(),
        number: z.string(),
        expiryMonth: z.string(),
        expiryYear: z.string(),
        ccv: z.string(),
    }).optional(),
    creditCardHolderInfo: z.object({
        name: z.string(),
        email: z.string(),
        cpfCnpj: z.string(),
        postalCode: z.string(),
        addressNumber: z.string(),
        phone: z.string(),
    }).optional(),
};

const upgradeProSchema = z.object({
    method: z.enum(['balance', 'pix', 'card']).default('balance'),
    installments: z.number().optional(),
    ...cardDataSchema
});

// Constantes do sistema de pontos
const POINTS_RATE = 1000; // 1000 pontos
const MONEY_VALUE = 0.03; // = R$ 0,03

/**
 * Função auxiliar para verificar e converter pontos automaticamente
 * O dinheiro sai do system_balance (caixa operacional alimentado por ads)
 */
async function autoConvertPoints(client: PoolClient, userId: string | number): Promise<{ converted: boolean; pointsConverted: number; moneyCredited: number; remainingPoints: number }> {
    const userRes = await client.query('SELECT ad_points, balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const currentPoints = userRes.rows[0].ad_points || 0;

    if (currentPoints < POINTS_RATE) {
        return { converted: false, pointsConverted: 0, moneyCredited: 0, remainingPoints: currentPoints };
    }

    const lots = Math.floor(currentPoints / POINTS_RATE);
    const pointsToConvert = lots * POINTS_RATE;
    const moneyToCredit = lots * MONEY_VALUE;
    const remainingPoints = currentPoints - pointsToConvert;

    // Verificar se há saldo suficiente no caixa operacional
    const systemRes = await client.query('SELECT system_balance FROM system_config LIMIT 1 FOR UPDATE');
    const systemBalance = parseFloat(systemRes.rows[0]?.system_balance || '0');

    if (systemBalance < moneyToCredit) {
        // Não há saldo no caixa - não converte
        console.warn(`[POINTS] Caixa insuficiente para conversão. Caixa: ${systemBalance}, Necessário: ${moneyToCredit}`);
        return { converted: false, pointsConverted: 0, moneyCredited: 0, remainingPoints: currentPoints };
    }

    // 1. Descontar do caixa operacional
    await client.query(
        `UPDATE system_config SET system_balance = system_balance - $1`,
        [moneyToCredit]
    );

    // 2. Creditar no usuário
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
 * Recompensa por Video (Rewarded Ads)
 * Sistema de Pontos: 1000 pts = R$ 0,03 (conversão automática!)
 */
monetizationRoutes.post('/reward-video', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        const REWARD_POINTS = 50; // 50 pontos por vídeo
        const REWARD_SCORE = 5; // +5 pontos de Score
        const COOLDOWN_MINUTES = 10;

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // 1. Verificar cooldown
            const userRes = await client.query('SELECT last_reward_at, score, ad_points FROM users WHERE id = $1', [user.id]);
            const lastReward = userRes.rows[0].last_reward_at;

            if (lastReward) {
                const diff = (Date.now() - new Date(lastReward).getTime()) / (1000 * 60);
                if (diff < COOLDOWN_MINUTES) {
                    throw new Error(`Aguarde mais ${Math.ceil(COOLDOWN_MINUTES - diff)} minutos para o próximo vídeo.`);
                }
            }

            // 2. Dar pontos
            await client.query(
                'UPDATE users SET ad_points = COALESCE(ad_points, 0) + $1, score = score + $2, last_reward_at = NOW() WHERE id = $3',
                [REWARD_POINTS, REWARD_SCORE, user.id]
            );

            // 3. Conversão automática
            const conversion = await autoConvertPoints(client, user.id);

            // 4. Buscar pontos atualizados
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
});

/**
 * Assinatura Cred30 PRO
 */
monetizationRoutes.post('/upgrade-pro', authMiddleware, async (c) => {
    try {
        const body = await c.req.json();
        const { method, installments } = upgradeProSchema.parse(body);

        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        // 1. Verificar se já é PRO
        const userCheck = await pool.query('SELECT membership_type, balance, email, name, cpf FROM users WHERE id = $1', [user.id]);
        if (userCheck.rows[0].membership_type === 'PRO') {
            return c.json({ success: false, message: 'Você já é um membro PRO!' }, 400);
        }

        // 2. Calcular valores com taxas
        const payMethod = method as PaymentMethod;
        const { total: finalAmount, fee } = calculateTotalToPay(PRO_UPGRADE_FEE, payMethod);

        if (payMethod === 'balance') {
            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                if (parseFloat(userCheck.rows[0].balance) < PRO_UPGRADE_FEE) {
                    throw new Error('Saldo insuficiente para o upgrade PRO.');
                }

                // Cobrar taxa
                await client.query('UPDATE users SET balance = balance - $1, membership_type = $2 WHERE id = $3', [PRO_UPGRADE_FEE, 'PRO', user.id]);

                // Distribuir lucros (85% para cotistas / 15% Operacional)
                const feeForProfit = PRO_UPGRADE_FEE * 0.85;
                const feeForOperational = PRO_UPGRADE_FEE * 0.15;

                await client.query(
                    'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                    [feeForOperational, feeForProfit]
                );

                // Registrar transação
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
        }

        // 3. Pagamento Externo (PIX ou CARTÃO)
        let paymentData: any;

        // Buscar CPF do usuário para Asaas
        const userCpf = userCheck.rows[0]?.cpf;
        const userName = userCheck.rows[0]?.name;

        if (USE_ASAAS) {
            if (payMethod === 'pix') {
                try {
                    paymentData = await createPixPayment({
                        amount: finalAmount,
                        description: `Upgrade PRO - ${userName?.split(' ')[0] || 'Usuário'}`,
                        email: userCheck.rows[0].email,
                        external_reference: user.id.toString(),
                        cpf: userCpf,
                        name: userName
                    });
                } catch (pixErr) {
                    console.error('Erro PIX Monetization:', pixErr);
                    paymentData = { id: null };
                }
            } else {
                if (!body.creditCard) return c.json({ success: false, message: 'Dados do cartão são obrigatórios' }, 400);
                try {
                    paymentData = await createCardPayment({
                        amount: finalAmount,
                        description: `Upgrade PRO`,
                        email: userCheck.rows[0].email,
                        external_reference: user.id.toString(),
                        installments: installments || 1,
                        cpf: userCpf,
                        name: userName,
                        creditCard: body.creditCard,
                        creditCardHolderInfo: body.creditCardHolderInfo
                    });
                } catch (cardErr) {
                    console.error('Erro Cartão Monetization:', cardErr);
                    throw cardErr;
                }
            }
        } else {
            console.log('[MONETIZATION] Modo manual ativo. Pulando Asaas para Upgrade PRO.');
        }

        // 4. Criar transação pendente
        const transResult = await executeInTransaction(pool, async (client: PoolClient) => {
            const trans = await createTransaction(
                client,
                user.id,
                'MEMBERSHIP_UPGRADE',
                -PRO_UPGRADE_FEE,
                `Upgrade PRO via ${payMethod.toUpperCase()}`,
                'PENDING',
                {
                    external_id: paymentData.id,
                    payment_method: payMethod,
                    is_upgrade: true
                }
            );
            return trans;
        });

        return c.json({
            success: true,
            message: payMethod === 'pix' ? 'QR Code gerado com sucesso!' : 'Pagamento processado!',
            data: {
                paymentId: paymentData.id,
                transactionId: transResult.data?.transactionId,
                pixData: (payMethod === 'pix' && USE_ASAAS) ? {
                    qr_code: paymentData.qr_code,
                    qr_code_base64: paymentData.qr_code_base64
                } : null,
                manualPix: (!USE_ASAAS && payMethod === 'pix') ? {
                    key: ADMIN_PIX_KEY,
                    owner: 'Admin Cred30',
                    description: `Transferir R$ ${finalAmount.toFixed(2)} para ativar PRO`
                } : null
            }
        });

    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

/**
 * Comprar Selo de Verificado (Confiança + Score)
 */
monetizationRoutes.post('/buy-verified-badge', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // Verificar se já possui
            const userRes = await client.query('SELECT is_verified, balance FROM users WHERE id = $1', [user.id]);
            if (userRes.rows[0].is_verified) {
                throw new Error('Você já possui o Selo de Verificado!');
            }

            if (parseFloat(userRes.rows[0].balance) < VERIFIED_BADGE_PRICE) {
                throw new Error(`Saldo insuficiente. Necessário R$ ${VERIFIED_BADGE_PRICE.toFixed(2)}.`);
            }

            // Cobrar
            await client.query('UPDATE users SET balance = balance - $1, is_verified = TRUE WHERE id = $2', [VERIFIED_BADGE_PRICE, user.id]);

            // Dar Score Bônus pela Confiança (+100)
            await updateScore(client, user.id, 100, 'Compra de Selo de Verificado (Confiança)');

            // Distribuir Lucro (100% Margem) -> 85% Profit Pool / 15% Operacional
            const feeForProfit = VERIFIED_BADGE_PRICE * 0.85;
            const feeForOperational = VERIFIED_BADGE_PRICE * 0.15;
            await client.query(
                'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                [feeForOperational, feeForProfit]
            );

            // Registrar Transação
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
        return c.json({ success: true, message: 'Selo de Verificado Adquirido! Sua confiança aumentou.' });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

/**
 * Comprar Pacote de Score (Boost)
 */
monetizationRoutes.post('/buy-score-boost', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [user.id]);

            if (parseFloat(userRes.rows[0].balance) < SCORE_BOOST_PRICE) {
                throw new Error(`Saldo insuficiente. Necessário R$ ${SCORE_BOOST_PRICE.toFixed(2)}.`);
            }

            // Cobrar
            await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [SCORE_BOOST_PRICE, user.id]);

            // Dar Boost
            await updateScore(client, user.id, SCORE_BOOST_POINTS, 'Compra de Pacote Score Boost');

            // Distribuir Lucro -> 85% Profit Pool / 15% Operacional
            const feeForProfit = SCORE_BOOST_PRICE * 0.85;
            const feeForOperational = SCORE_BOOST_PRICE * 0.15;
            await client.query(
                'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                [feeForOperational, feeForProfit]
            );

            // Registrar Transação
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
        return c.json({ success: true, message: `Boost Ativado! +${SCORE_BOOST_POINTS} pontos adicionados ao seu Score.` });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

/**
 * Check-in Diário (Recompensa por retenção + Ad)
 * Sistema de Pontos: 1000 pts = R$ 0,03 (conversão automática!)
 */
monetizationRoutes.post('/daily-checkin', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const pool = getDbPool(c);

        const CHECKIN_POINTS = 100; // 100 pontos por check-in diário
        const CHECKIN_SCORE = 10;

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // Verificar se já fez hoje
            const userRes = await client.query('SELECT last_checkin_at, ad_points FROM users WHERE id = $1', [user.id]);
            const lastCheckin = userRes.rows[0].last_checkin_at;

            if (lastCheckin) {
                const lastDate = new Date(lastCheckin).toLocaleDateString();
                const today = new Date().toLocaleDateString();
                if (lastDate === today) {
                    throw new Error('Você já realizou o check-in de hoje! Volte amanhã.');
                }
            }

            // Dar pontos
            await client.query(
                'UPDATE users SET ad_points = COALESCE(ad_points, 0) + $1, score = score + $2, last_checkin_at = NOW() WHERE id = $3',
                [CHECKIN_POINTS, CHECKIN_SCORE, user.id]
            );

            // Conversão automática
            const conversion = await autoConvertPoints(client, user.id);

            // Buscar pontos atualizados
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
});

/**
 * Consulta de Reputação de Terceiros (Monetização estilo Serasa)
 */
monetizationRoutes.get('/reputation-check/:email', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as UserContext;
        const targetEmail = c.req.param('email').toLowerCase().trim();
        const pool = getDbPool(c);

        const result = await executeInTransaction(pool, async (client: PoolClient) => {
            // 1. Verificar se o usuário tem saldo para a consulta
            const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
            if (parseFloat(userRes.rows[0].balance) < REPUTATION_CHECK_PRICE) {
                throw new Error(`Saldo insuficiente. A consulta de idoneidade custa R$ ${REPUTATION_CHECK_PRICE.toFixed(2)}.`);
            }

            // 2. Buscar o alvo da consulta
            const targetRes = await client.query(
                'SELECT name, score, is_verified, membership_type, created_at, status FROM users WHERE email = $1',
                [targetEmail]
            );

            if (targetRes.rows.length === 0) {
                throw new Error('Nenhum associado encontrado com este e-mail.');
            }

            const target = targetRes.rows[0];

            // 3. Cobrar a taxa (Revenue 85/15)
            await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [REPUTATION_CHECK_PRICE, user.id]);

            const feeForProfit = REPUTATION_CHECK_PRICE * 0.85;
            const feeForOperational = REPUTATION_CHECK_PRICE * 0.15;

            await client.query(
                'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
                [feeForOperational, feeForProfit]
            );

            // 4. Registrar transação
            await createTransaction(
                client,
                user.id,
                'REPUTATION_CONSULT',
                -REPUTATION_CHECK_PRICE,
                `Consulta de Idoneidade: ${targetEmail}`,
                'APPROVED'
            );

            // 5. Retornar os dados
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
});

export { monetizationRoutes };
