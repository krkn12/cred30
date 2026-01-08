import { Pool, PoolClient } from 'pg';
import {
    DIVIDEND_USER_SHARE,
    MAINTENANCE_TAX_SHARE,
    MAINTENANCE_OPERATIONAL_SHARE,
    MAINTENANCE_OWNER_SHARE
} from '../../shared/constants/business.constants';
import { notificationService } from './notification.service';

export const distributeProfits = async (pool: Pool | PoolClient): Promise<any> => {
    try {
        // Buscar configuração do sistema
        const configResult = await pool.query('SELECT * FROM system_config LIMIT 1');
        const config = configResult.rows[0];

        if (!config || parseFloat(config.profit_pool) <= 0) {
            return { success: false, message: 'Não há resultados acumulados para distribuir' };
        }

        // ---------------------------------------------------------------------
        // NOVA LÓGICA DE DISTRIBUIÇÃO PONDERADA (Score-Based)
        // Incentivos:
        // 1. Histórico de Pagamento (Loans Paid) -> Ganha peso
        // 2. Volume de Gastos (Total Spent) -> Ganha peso
        // 3. Ativação (2FA, PRO) -> Ganha peso
        // ---------------------------------------------------------------------

        const eligibleUsersQuery = `
            SELECT 
                q.user_id, 
                COUNT(q.id) as quota_count,
                u.two_factor_enabled,
                u.membership_type,
                COALESCE((SELECT COUNT(*) FROM loans l WHERE l.user_id = q.user_id AND l.status = 'PAID'), 0) as paid_loans,
                COALESCE((SELECT SUM(amount) FROM transactions t 
                 WHERE t.user_id = q.user_id 
                 AND t.type IN ('MARKET_PURCHASE', 'MARKET_PURCHASE_CREDIT', 'GAME_BET', 'PREMIUM_PURCHASE', 'MEMBERSHIP_UPGRADE', 'REPUTATION_CONSULT')
                ), 0) as total_spent
            FROM quotas q
            JOIN users u ON u.id = q.user_id
            WHERE q.status = 'ACTIVE'
            AND (
                -- Mantém a regra básica de elegibilidade mínima (ter interagido)
                EXISTS (SELECT 1 FROM loans l WHERE l.user_id = q.user_id AND l.status IN ('APPROVED', 'PAYMENT_PENDING', 'PAID'))
                OR 
                EXISTS (
                    SELECT 1 FROM transactions t 
                    WHERE t.user_id = q.user_id 
                    AND t.type IN ('GAME_BET', 'AD_REWARD', 'EDUCATION_REWARD', 'MARKET_PURCHASE', 'MEMBERSHIP_UPGRADE')
                )
                OR
                EXISTS (SELECT 1 FROM voting_votes vv WHERE vv.user_id = q.user_id)
            )
            GROUP BY q.user_id, u.two_factor_enabled, u.membership_type
        `;

        const eligibleResult = await pool.query(eligibleUsersQuery);
        let usersWithQuotas = eligibleResult.rows;

        // Calcular "Cotas Ponderadas" (Weighted Shares)
        // Multiplicador Base = 1.0
        usersWithQuotas = usersWithQuotas.map(user => {
            let multiplier = 1.0;

            // Bônus 1: Ativação (+10% se tiver 2FA, +20% se for PRO)
            if (user.two_factor_enabled) multiplier += 0.1;
            if (user.membership_type === 'PRO') multiplier += 0.2;

            // Bônus 2: Bom Pagador (+5% por empréstimo pago, limitado a +50%)
            const paidLoansBonus = Math.min(parseInt(user.paid_loans || 0) * 0.05, 0.5);
            multiplier += paidLoansBonus;

            // Bônus 3: Grande Gastador (+10% a cada R$ 500 gastos, limitado a +200%)
            const spent = parseFloat(user.total_spent || 0);
            if (spent > 0) {
                // Exemplo: 500 gastos = +0.1. 1000 gastos = +0.2
                const spendBonus = Math.min(spent / 5000, 2.0); // Cap de 2x (precisa gastar 10k)
                multiplier += (spent / 500) * 0.1;
            }

            // Apply weighting
            const rawQuotas = parseInt(user.quota_count);
            const weightedQuotas = rawQuotas * multiplier;

            return {
                ...user,
                raw_quotas: rawQuotas,
                multiplier: multiplier,
                weighted_quotas: weightedQuotas
            };
        });

        // Calcular total de COTAS PONDERADAS (não cotas físicas)
        const totalWeightedQuotas = usersWithQuotas.reduce((acc, row) => acc + row.weighted_quotas, 0);

        console.log('DEBUG - Cotas Ponderadas Totais:', totalWeightedQuotas.toFixed(2));

        if (totalWeightedQuotas <= 0) {
            return {
                success: false,
                message: `Não há elegibilidade suficiente. Lucro retido.`,
                data: { profitPoolRetained: parseFloat(config.profit_pool) }
            };
        }

        const profit = parseFloat(config.profit_pool);
        const totalForUsers = profit * DIVIDEND_USER_SHARE;

        // Rateio detalhado da manutenção
        const taxAmount = profit * MAINTENANCE_TAX_SHARE;
        const operationalAmount = profit * MAINTENANCE_OPERATIONAL_SHARE;
        const ownerAmount = profit * MAINTENANCE_OWNER_SHARE;
        const totalForMaintenance = taxAmount + operationalAmount + ownerAmount;

        // O valor agora é por "Cota Ponderada"
        const dividendPerWeightedQuota = totalForUsers / totalWeightedQuotas;

        // Distribuir
        console.log('DEBUG - Iniciando distribuição ponderada...', { totalProfit: profit, usersCount: usersWithQuotas.length });

        const userIds = usersWithQuotas.map(u => u.user_id);
        const userAmounts = usersWithQuotas.map(u => Number((u.weighted_quotas * dividendPerWeightedQuota).toFixed(2)));
        const userDescriptions = usersWithQuotas.map(u => {
            const extra = ((u.multiplier - 1) * 100).toFixed(0);
            return `Distribuição de Lucro (${u.raw_quotas} cotas + ${extra}% bônus de engajamento)`;
        });

        // Executar atualização em massa
        if (userIds.length > 0) {
            await pool.query(`
                WITH distribution_data AS (
                    SELECT 
                        unnest($1::int[]) as u_id, 
                        unnest($2::decimal[]) as u_amount,
                        unnest($3::text[]) as u_desc
                ),
                update_balances AS (
                    UPDATE users u
                    SET balance = u.balance + dd.u_amount
                    FROM distribution_data dd
                    WHERE u.id = dd.u_id
                )
                INSERT INTO transactions (user_id, type, amount, description, status)
                SELECT u_id, 'DEPOSIT', u_amount, u_desc, 'APPROVED'
                FROM distribution_data
                WHERE u_amount > 0;
            `, [userIds, userAmounts, userDescriptions]);
        }

        const distributedTotal = userAmounts.reduce((acc, val) => acc + val, 0);
        const roundingDifference = totalForUsers - distributedTotal;
        const finalMaintenance = totalForMaintenance + roundingDifference;

        // Atualizar config
        await pool.query(
            `UPDATE system_config 
             SET system_balance = system_balance + $1, 
                 total_tax_reserve = total_tax_reserve + $2,
                 total_operational_reserve = total_operational_reserve + $3,
                 total_owner_profit = total_owner_profit + $4,
                 profit_pool = 0`,
            [finalMaintenance, taxAmount, operationalAmount, ownerAmount]
        );

        // Notificar Admin
        notificationService.notifyProfitDistributed(profit).catch(e => console.error('Erro ao notificar admin:', e));

        return {
            success: true,
            message: 'Distribuição Ponderada realizada com sucesso!',
            data: {
                totalProfit: profit,
                distributed: distributedTotal,
                dividendPerWeightedQuota,
                totalWeightedQuotas
            },
        };
    } catch (error) {
        console.error('Erro ao distribuir bônus:', error);
        throw error;
    }
};
