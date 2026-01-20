import { Pool, PoolClient } from 'pg';

/**
 * Atualiza o score de crédito do usuário
 * @param pool Conexão com o banco
 * @param userId ID do usuário
 * @param points Pontos a adicionar (positivo) ou remover (negativo)
 * @param reason Motivo da atualização
 */
export const updateScore = async (
    pool: Pool | PoolClient,
    userId: string | number,
    points: number,
    reason: string
) => {
    try {
        // Regra Anti-Farm: Se for ganho de pontos (points > 0),
        // só permite se o usuário já tiver algum gasto na plataforma.
        // Exceções: Compras de cotas, upgrades ou pacotes de score (o gasto é a própria ação).
        const isException = ['Compra', 'Cota', 'Aquisição', 'Participação', 'Upgrade', 'Selo', 'Boost'].some(kw => reason.includes(kw));

        if (points > 0 && !isException) {
            const spendingRes = await pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM quotas WHERE user_id = $1) as quotas_count,
                    COALESCE((SELECT SUM(amount) FROM marketplace_orders WHERE buyer_id = $1 AND status = 'COMPLETED'), 0) as marketplace_spent,
                    COALESCE((SELECT SUM(budget_gross) FROM promo_videos WHERE user_id = $1), 0) as campaign_spent,
                    COALESCE((SELECT SUM(ABS(amount)) FROM transactions 
                        WHERE user_id = $1 AND status = 'APPROVED' 
                        AND type IN ('MEMBERSHIP_UPGRADE', 'BUY_VERIFIED_BADGE', 'BUY_SCORE_PACKAGE', 'MARKET_BOOST')
                    ), 0) as platform_spent
                FROM users WHERE id = $1
            `, [userId]);

            if (spendingRes.rows.length > 0) {
                const s = spendingRes.rows[0];
                const totalSpent = parseFloat(s.marketplace_spent) + parseFloat(s.campaign_spent) + parseFloat(s.platform_spent) + (parseInt(s.quotas_count) * 8);

                if (totalSpent <= 0) {
                    console.log(`[Score] Bloqueado farming para usuário ${userId}. Gasto total: R$ 0.00`);
                    return; // Aborta ganho de pontos
                }
            }
        }

        // Garantir que o score não seja negativo
        await pool.query(
            'UPDATE users SET score = GREATEST(0, score + $1) WHERE id = $2',
            [points, userId]
        );

        console.log(`[Score] Usuário ${userId}: ${points > 0 ? '+' : ''}${points} pontos. Motivo: ${reason}`);
    } catch (error) {
        console.error('Erro ao atualizar score:', error);
    }
};

// Constantes de Pontuação
export const SCORE_REWARDS = {
    QUOTA_PURCHASE: 10,       // Por cota comprada
    LOAN_PAYMENT_ON_TIME: 25, // Por parcela paga em dia
    GAME_PARTICIPATION: 2,    // Por lote de giros/participação
    RELIABLE_MEMBER: 50,      // Bônus mensal para membros sem pendências (pode ser usado em scheduler)
    VOTING_PARTICIPATION: 10, // Por voto em proposta de governança
    REFERRAL_ACTIVE_USER: 30, // Padrinho ganha quando indicado compra cota (indicação ativa)
};

export const SCORE_PENALTIES = {
    LATENESS: -50,            // Por atraso no pagamento
    LOAN_REJECTION: -10,      // Tentativa de empréstimo sem critério (opcional)
    DAILY_DECAY: -10          // Decaimento diário por inatividade/manutenção
};

/**
 * Aplica o decaimento diário de score para todos os usuários
 * Isso força o usuário a engajar (ver ads) para manter o score.
 */
export const decreaseDailyScore = async (pool: Pool): Promise<{ success: boolean; affectedUsers: number }> => {
    try {
        // Reduzir score de todos os usuários com score > 0
        // Decaimento de 10 pontos por dia
        const result = await pool.query(`
            UPDATE users 
            SET score = GREATEST(0, score - 10) 
            WHERE score > 0
        `);

        console.log(`[Score] Decaimento diário aplicado a ${result.rowCount} usuários (-10 pontos).`);
        return { success: true, affectedUsers: result.rowCount || 0 };
    } catch (error) {
        console.error('Erro ao aplicar decaimento de score:', error);
        return { success: false, affectedUsers: 0 };
    }
};
