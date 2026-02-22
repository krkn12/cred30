import { Pool, PoolClient } from 'pg';
import { executeInTransaction, createTransaction, incrementSystemReserves } from '../../domain/services/transaction.service';

/**
 * Taxa de Conversão Oficial: 1000 pontos = R$ 0,07
 */
export const VALUE_PER_1000_POINTS = 0.07;
export const MIN_POINTS_FOR_CONVERSION = 1000;
export const POINTS_CONVERSION_RATE = 1000 / VALUE_PER_1000_POINTS; // ~14285.71

export class PointsService {
    /**
     * Adiciona pontos ao usuário
     */
    static async addPoints(
        pool: Pool | PoolClient,
        userId: string | number,
        amount: number,
        reason: string
    ) {
        if (amount <= 0) return;

        await pool.query(
            `UPDATE users 
             SET ad_points = COALESCE(ad_points, 0) + $1, 
                 total_ad_points = COALESCE(total_ad_points, 0) + $1 
             WHERE id = $2`,
            [amount, userId]
        );

        console.log(`[PointsService] +${amount} pts para usuário ${userId}. Motivo: ${reason}`);
    }

    /**
     * Converte pontos em saldo (balance)
     */
    static async convertPointsToBalance(
        pool: Pool,
        userId: string | number
    ): Promise<{ success: boolean; message?: string; data?: { convertedAmount: number; remainingPoints: number } }> {
        try {
            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                // 1. Buscar dados do usuário e config do sistema
                const userRes = await client.query('SELECT ad_points, balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
                const user = userRes.rows[0];

                if (!user) throw new Error('Usuário não encontrado.');

                const currentPoints = Math.floor(user.ad_points || 0);

                if (currentPoints < MIN_POINTS_FOR_CONVERSION) {
                    throw new Error(`Mínimo de ${MIN_POINTS_FOR_CONVERSION} pontos para conversão.`);
                }

                const systemRes = await client.query('SELECT total_operational_reserve FROM system_config LIMIT 1 FOR UPDATE');
                const systemBalance = parseFloat(systemRes.rows[0]?.total_operational_reserve || '0');

                // 2. Calcular valores
                const pointsToConvert = Math.floor(currentPoints / MIN_POINTS_FOR_CONVERSION) * MIN_POINTS_FOR_CONVERSION;
                // Ex: 1000 pts -> 1 unidade * R$ 0.07 = R$ 0.07
                const amountToAdd = (pointsToConvert / 1000) * VALUE_PER_1000_POINTS;

                if (systemBalance < amountToAdd) {
                    throw new Error('Fundo de Reserva Operacional insuficiente no momento. Tente novamente mais tarde.');
                }

                // 3. Executar atualizações
                // Debita da Reserva Operacional (que recebe 25% das taxas)
                await incrementSystemReserves(client, {
                    operational: -amountToAdd
                });
                await client.query('UPDATE users SET ad_points = ad_points - $1, balance = balance + $2 WHERE id = $3', [pointsToConvert, amountToAdd, userId]);

                // 4. Registrar transação
                await createTransaction(
                    client,
                    userId.toString(),
                    'POINTS_CONVERSION',
                    amountToAdd,
                    `Conversão de ${pointsToConvert} pontos em saldo`,
                    'APPROVED',
                    { points: pointsToConvert, rate: VALUE_PER_1000_POINTS }
                );

                console.log(`[PointsService] Conversão: ${pointsToConvert} pts -> R$ ${amountToAdd.toFixed(2)} para usuário ${userId}`);

                return {
                    convertedAmount: amountToAdd,
                    remainingPoints: currentPoints - pointsToConvert
                };
            });

            if (!result.success) {
                return { success: false, message: result.error };
            }

            return { success: true, data: result.data };

        } catch (error: any) {
            console.error('[PointsService] Erro na conversão:', error.message);
            return { success: false, message: error.message };
        }
    }
}
