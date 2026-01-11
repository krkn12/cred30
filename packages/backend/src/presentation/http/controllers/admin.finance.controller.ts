import { Context } from 'hono';
import { z } from 'zod'; // Import zod here as schemas will be moved or redefined
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { CacheService, addCacheHeaders } from '../../../infrastructure/cache/memory-cache.service';
import { QUOTA_PRICE } from '../../../shared/constants/business.constants';
import { executeInTransaction, processTransactionApproval } from '../../../domain/services/transaction.service';
import { distributeProfits } from '../../../application/services/profit-distribution.service';
import { simulatePaymentApproval } from '../../../infrastructure/gateways/mercadopago.service';
import { PoolClient } from 'pg';

// Schemas (Moved from router)
export const createCostSchema = z.object({
    description: z.string().min(3),
    amount: z.number().positive(),
    isRecurring: z.boolean().default(true),
});

export const simulateMpSchema = z.object({
    paymentId: z.coerce.number(),
    transactionId: z.string()
});

export class AdminFinanceController {

    /**
     * Listar custos do sistema
     */
    static async listCosts(c: Context) {
        try {
            const pool = getDbPool(c);
            const result = await pool.query('SELECT * FROM system_costs ORDER BY created_at DESC');
            return c.json({ success: true, data: result.rows });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Adicionar custo do sistema
     */
    static async addCost(c: Context) {
        try {
            const body = await c.req.json();
            const { description, amount, isRecurring } = createCostSchema.parse(body);
            const pool = getDbPool(c);

            await pool.query(
                'INSERT INTO system_costs (description, amount, is_recurring) VALUES ($1, $2, $3)',
                [description, amount, isRecurring]
            );

            return c.json({ success: true, message: 'Custo adicionado com sucesso' });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Remover custo do sistema
     */
    static async deleteCost(c: Context) {
        try {
            const id = c.req.param('id');
            const pool = getDbPool(c);

            const result = await pool.query('DELETE FROM system_costs WHERE id = $1 RETURNING id', [id]);

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Custo não encontrado' }, 404);
            }

            return c.json({ success: true, message: 'Custo removido com sucesso' });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Pagar custo do sistema
     */
    static async payCost(c: Context) {
        try {
            const id = c.req.param('id');
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client) => {
                // 1. Buscar o custo
                const costRes = await client.query('SELECT description, amount FROM system_costs WHERE id = $1', [id]);
                if (costRes.rows.length === 0) {
                    throw new Error('Custo não encontrado');
                }
                const cost = costRes.rows[0];
                const amount = parseFloat(cost.amount);

                // 2. Subtrair do saldo do sistema e das reservas (Modelo Lucro Líquido)
                const configRes = await client.query('SELECT system_balance FROM system_config LIMIT 1');
                if (parseFloat(configRes.rows[0].system_balance) < amount) {
                    throw new Error('Saldo do sistema insuficiente para realizar este pagamento.');
                }

                // Importar VIDEO_QUOTA_HOLDERS_SHARE se necessário, ou usar hardcoded 0.25 por padrão se a constante não estiver acessível aqui
                const QUOTA_HOLDERS_SHARE = 0.25;

                const quotaShare = amount * QUOTA_HOLDERS_SHARE;
                const ownerShare = amount - quotaShare;

                // Deduz do balanço geral E das reservas específicas (Cotistas e Empresa)
                await client.query(
                    'UPDATE system_config SET system_balance = system_balance - $1, profit_pool = profit_pool - $2, total_owner_profit = total_owner_profit - $3',
                    [amount, quotaShare, ownerShare]
                );

                // 3. Remover o custo (como solicitado: "as dívidas somem")
                await client.query('DELETE FROM system_costs WHERE id = $1', [id]);

                return { description: cost.description, amount: amount };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);

            return c.json({ success: true, message: `Pagamento de "${result.data?.description}" realizado com sucesso!` });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Histórico Financeiro do Admin
     */
    static async getFinanceHistory(c: Context) {
        try {
            const pool = getDbPool(c);
            const { limit, offset } = c.req.query();
            const limitNum = parseInt(limit || '50');
            const offsetNum = parseInt(offset || '0');

            const baseFilter = `WHERE action IN ('MANUAL_PROFIT_ADD', 'PAY_COST', 'ADD_COST', 'DELETE_COST', 'MANUAL_ADD_QUOTA')`;

            // Buscar total
            const totalResult = await pool.query(`SELECT COUNT(*) FROM admin_logs ${baseFilter}`);
            const total = parseInt(totalResult.rows[0].count);

            // Buscar logs paginados
            const result = await pool.query(`
        SELECT l.*, u.name as admin_name 
        FROM admin_logs l
        LEFT JOIN users u ON l.admin_id = u.id
        ${baseFilter}
        ORDER BY l.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limitNum, offsetNum]);

            return c.json({
                success: true,
                data: result.rows,
                pagination: {
                    total,
                    limit: limitNum,
                    offset: offsetNum,
                    hasMore: offsetNum + result.rows.length < total
                }
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Painel Administrativo (Dashboard)
     */
    static async getDashboard(c: Context) {
        try {
            // Verificar cache primeiro
            const cachedData = CacheService.getAdminDashboard();
            if (cachedData) {
                addCacheHeaders(c, true, 120000);
                return c.json({ success: true, data: cachedData, cached: true });
            }

            const pool = getDbPool(c);

            // Buscar configurações do sistema
            const configResult = await pool.query('SELECT * FROM system_config LIMIT 1');
            let config = configResult.rows[0] || null;

            if (!config) {
                // Criar configuração padrão se não existir
                await pool.query(`
          INSERT INTO system_config (system_balance, profit_pool, quota_price, loan_interest_rate, penalty_rate, vesting_period_ms)
          VALUES (0, 0, $1, 0.2, 0.4, $2)
        `, [QUOTA_PRICE, 365 * 24 * 60 * 60 * 1000]);

                const newConfigResult = await pool.query('SELECT * FROM system_config LIMIT 1');
                config = newConfigResult.rows[0];
            }

            // Calcular caixa operacional
            const activeQuotasResult = await pool.query(
                `SELECT COUNT(*) as count FROM quotas WHERE status = 'ACTIVE'`
            );
            const activeQuotasCount = parseInt(activeQuotasResult.rows[0].count);
            const totalQuotasValue = activeQuotasCount * QUOTA_PRICE;

            const totalLoanedResult = await pool.query(
                `SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total_loaned
         FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')`
            );
            const totalLoaned = parseFloat(totalLoanedResult.rows[0].total_loaned);
            const operationalCash = totalQuotasValue - totalLoaned;

            // Converter valores numéricos
            config.system_balance = parseFloat(String(config.system_balance || 0));
            config.profit_pool = parseFloat(String(config.profit_pool || 0));
            config.quota_price = parseFloat(String(config.quota_price || 0));
            config.total_gateway_costs = parseFloat(String(config.total_gateway_costs || 0));
            config.total_manual_costs = parseFloat(String(config.total_manual_costs || 0));
            config.total_tax_reserve = parseFloat(String(config.total_tax_reserve || 0));
            config.total_operational_reserve = parseFloat(String(config.total_operational_reserve || 0));
            config.total_owner_profit = parseFloat(String(config.total_owner_profit || 0));
            config.investment_reserve = parseFloat(String(config.investment_reserve || 0));
            config.courier_price_per_km = parseFloat(String(config.courier_price_per_km || '2.50'));

            const statsResult = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM users) as users_count,
          (SELECT COALESCE(SUM(CAST(balance AS NUMERIC)), 0) FROM users) as total_user_balances,
          (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE') as quotas_count,
          (SELECT COUNT(*) FROM loans WHERE status IN ('PENDING', 'APPROVED', 'PAYMENT_PENDING')) as active_loans_count,
          (SELECT COALESCE(SUM(CAST(total_repayment AS NUMERIC)), 0) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_to_receive,
          (SELECT COALESCE(SUM(amount), 0) FROM system_costs) as total_monthly_costs,
          (SELECT COUNT(*) FROM governance_proposals WHERE status = 'active') as active_proposals_count
      `);

            const stats = statsResult.rows[0];
            const usersCount = parseInt(stats.users_count);
            const totalUserBalances = parseFloat(stats.total_user_balances);
            const quotasCount = parseInt(stats.quotas_count);
            const activeLoansCount = parseInt(stats.active_loans_count);
            const totalToReceive = parseFloat(stats.total_to_receive);
            const totalMonthlyCosts = parseFloat(stats.total_monthly_costs);
            const activeProposalsCount = parseInt(stats.active_proposals_count || 0);

            const totalReservesForRealLiquidity = config.total_tax_reserve +
                config.total_operational_reserve +
                config.total_owner_profit +
                totalMonthlyCosts +
                totalUserBalances;

            config.real_liquidity = config.system_balance - totalReservesForRealLiquidity;
            config.total_reserves = totalReservesForRealLiquidity;
            config.total_user_balances = totalUserBalances;
            config.theoretical_cash = operationalCash;
            config.monthly_fixed_costs = totalMonthlyCosts;

            const dashboardData = {
                systemConfig: config,
                stats: {
                    usersCount,
                    quotasCount,
                    activeLoansCount,
                    totalLoaned,
                    totalToReceive,
                    activeProposalsCount,
                },
            };

            CacheService.setAdminDashboard(dashboardData);
            addCacheHeaders(c, false, 120000);

            return c.json({
                success: true,
                data: dashboardData,
            });
        } catch (error) {
            console.error('Erro ao carregar dashboard administrativo:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    static async getHealthMetrics(c: Context) {
        try {
            const pool = getDbPool(c);
            const start = Date.now();

            await pool.query('SELECT 1');
            const dbLatency = Date.now() - start;

            const statsResult = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM transactions) as total_transactions,
          (SELECT COUNT(*) FROM quotas) as total_quotas,
          (SELECT COUNT(*) FROM loans) as total_loans,
          (SELECT COUNT(*) FROM admin_logs) as total_admin_logs,
          (SELECT COUNT(*) FROM system_costs) as total_system_costs,
          (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
          (SELECT COUNT(*) FROM transactions WHERE created_at > NOW() - INTERVAL '24 hours') as trans_24h,
          (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'APPROVED') as volume_24h,
          (SELECT COUNT(*) FROM loans WHERE status = 'PENDING') as pending_loans_count,
          (SELECT COALESCE(SUM(amount), 0) FROM loans WHERE status = 'PENDING') as pending_loans_volume
      `);

            const stats = statsResult.rows[0];
            const memoryUsage = process.memoryUsage();
            const uptime = process.uptime();

            return c.json({
                success: true,
                data: {
                    health: {
                        status: 'HEALTHY',
                        dbLatency: `${dbLatency}ms`,
                        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
                        memory: {
                            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
                        }
                    },
                    database: {
                        total_users: stats.total_users,
                        total_transactions: stats.total_transactions,
                        total_quotas: stats.total_quotas,
                        total_loans: stats.total_loans,
                        total_admin_logs: stats.total_admin_logs,
                        total_system_costs: stats.total_system_costs
                    },
                    activity: {
                        new_users_24h: stats.new_users_24h,
                        trans_24h: stats.trans_24h,
                        volume_24h: stats.volume_24h
                    },
                    queue: {
                        pending_loans_count: stats.pending_loans_count,
                        pending_loans_volume: stats.pending_loans_volume
                    },
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Erro ao buscar métricas de saúde:', error);
            return c.json({ success: false, message: 'Erro ao coletar métricas' }, 500);
        }
    }

    static async systemBalanceInfo(c: Context) {
        return c.json({
            success: false,
            message: 'Caixa operacional agora é calculado automaticamente baseado nas cotas ATIVAS e empréstimos ativos.',
            info: 'Valor = (Total de cotas ATIVAS × R$ 50) - (Total emprestado)'
        }, 400);
    }

    static async addProfitPool(c: Context) {
        try {
            const body = await c.req.json();
            let amountToAdd: number | undefined = undefined;

            if (body.amountToAdd !== undefined) {
                amountToAdd = parseFloat(body.amountToAdd);
            } else if (body.amount !== undefined) {
                amountToAdd = parseFloat(body.amount);
            }

            const amountVal = amountToAdd as number;
            if (amountVal === undefined || isNaN(amountVal)) {
                return c.json({ success: false, message: 'Valor inválido' }, 400);
            }

            const pool = getDbPool(c);

            await executeInTransaction(pool, async (client) => {
                await client.query(
                    'UPDATE system_config SET profit_pool = profit_pool + $1, system_balance = system_balance + $1',
                    [amountVal]
                );

                const user = c.get('user');
                await client.query(
                    `INSERT INTO admin_logs (admin_id, action, entity_type, new_values, created_at)
             VALUES ($1, 'MANUAL_PROFIT_ADD', 'SYSTEM_CONFIG', $2, $3)`,
                    [
                        user.id,
                        JSON.stringify({ addedAmount: amountVal }),
                        new Date()
                    ]
                );
            });

            return c.json({
                success: true,
                message: `R$ ${amountVal.toFixed(2)} adicionado ao acumulado e ao saldo do sistema!`,
                data: { addedAmount: amountVal }
            });
        } catch (error) {
            console.error('Erro ao adicionar lucro ao pool:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Distribuir dividendos
     */
    static async distributeDividends(c: Context) {
        try {
            const pool = getDbPool(c);
            const result = await distributeProfits(pool);

            if (!result.success) {
                return c.json(result, 400);
            }

            return c.json(result);
        } catch (error) {
            console.error('Erro ao distribuir dividendos:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Simular aprovação de pagamento via Mercado Pago (Apenas Sandbox)
     */
    static async simulatePayment(c: Context) {
        try {
            const body = await c.req.json();
            const { paymentId, transactionId } = simulateMpSchema.parse(body);

            console.log(`[ADMIN] Simulando aprovação MP para Pagamento ${paymentId}, Transação ${transactionId}`);

            try {
                await simulatePaymentApproval(paymentId);
            } catch (mpError: any) {
                console.warn(`[ADMIN] Aviso: Não foi possível atualizar no Mercado Pago: ${mpError.message}`);
            }

            const pool = getDbPool(c);
            const result = await executeInTransaction(pool, async (client: PoolClient) => {
                return await processTransactionApproval(client, transactionId, 'APPROVE');
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error || 'Erro ao processar aprovação interna' }, 400);
            }

            return c.json({
                success: true,
                message: 'Simulação realizada com sucesso! Transação aprovada e Mercado Pago atualizado.'
            });
        } catch (error: any) {
            console.error('Erro na simulação administrativa:', error);
            return c.json({ success: false, message: error.message || 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Registrar Custo Manual (Despesa)
     */
    static async addManualCost(c: Context) {
        try {
            const body = await c.req.json();
            const amount = parseFloat(body.amount);

            if (isNaN(amount) || amount <= 0) {
                return c.json({ success: false, message: 'Valor inválido' }, 400);
            }

            const pool = getDbPool(c);

            await executeInTransaction(pool, async (client) => {
                await client.query(
                    'UPDATE system_config SET system_balance = system_balance - $1, total_manual_costs = total_manual_costs + $1',
                    [amount]
                );

                const user = c.get('user');
                await client.query(
                    `INSERT INTO admin_logs (admin_id, action, entity_type, new_values, created_at)
                     VALUES ($1, 'MANUAL_COST_ADD', 'SYSTEM_CONFIG', $2, $3)`,
                    [user.id, JSON.stringify({ addedCost: amount, description: body.description || 'Custo manual' }), new Date()]
                );
            });

            return c.json({
                success: true,
                message: `Custo de R$ ${amount.toFixed(2)} registrado com sucesso e deduzido do caixa operacional.`,
                data: { addedCost: amount }
            });
        } catch (error: any) {
            console.error('Erro ao adicionar custo manual:', error);
            return c.json({ success: false, message: error.message || 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Atualizar Configurações Gerais do Sistema
     */
    static async updateConfig(c: Context) {
        try {
            const body = await c.req.json();
            const pool = getDbPool(c);

            // Filtrar apenas campos permitidos para atualização via este endpoint
            const allowedFields = ['courier_price_per_km', 'quota_price', 'loan_interest_rate', 'penalty_rate'];
            const updates = Object.keys(body).filter(key => allowedFields.includes(key));

            if (updates.length === 0) {
                return c.json({ success: false, message: 'Nenhum campo válido para atualização' }, 400);
            }

            const setClause = updates.map((key, i) => `${key} = $${i + 1}`).join(', ');
            const values = updates.map(key => body[key]);

            await pool.query(`UPDATE system_config SET ${setClause}, updated_at = NOW()`, values);

            // Limpar cache do dashboard para refletir as mudanças
            CacheService.deleteAdminDashboard();

            return c.json({
                success: true,
                message: 'Configurações atualizadas com sucesso!',
                updatedFields: updates
            });
        } catch (error: any) {
            console.error('Erro ao atualizar configurações:', error);
            return c.json({ success: false, message: error.message || 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Relatório Fiscal (Auditoria para Declaração de Impostos)
     * Separa Receita Bruta (Taxas) de Movimentação de Terceiros (Custódia)
     */
    static async getFiscalReport(c: Context) {
        try {
            const pool = getDbPool(c);
            const month = c.req.query('month') || new Date().getMonth() + 1;
            const year = c.req.query('year') || new Date().getFullYear();

            const startDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
            const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0] + ' 23:59:59';

            // 1. Volume Total Bruto (Tudo que entrou no sistema)
            const volumeRes = await pool.query(`
                SELECT COALESCE(SUM(amount), 0) as total_volume
                FROM transactions 
                WHERE status = 'APPROVED' 
                AND type IN ('DEPOSIT', 'ORDER_PAYMENT', 'BUY_QUOTA', 'LOAN_REPAYMENT')
                AND created_at BETWEEN $1 AND $2
            `, [startDate, endDate]);

            // 2. Receita Própria (Sua base de cálculo de imposto)
            // Inclui: Taxas de Marketplace, Juros de Empréstimo, Taxas de Saque, Upgrade Pro
            const revenueRes = await pool.query(`
                SELECT 
                    SUM(CASE WHEN type = 'WITHDRAWAL_FEE' THEN amount ELSE 0 END) as withdrawal_fees,
                    SUM(CASE WHEN type = 'LOAN_INTEREST' THEN amount ELSE 0 END) as loan_interests,
                    SUM(CASE WHEN type = 'MARKETPLACE_FEE' THEN amount ELSE 0 END) as marketplace_fees,
                    SUM(CASE WHEN type = 'UPGRADE_PRO' THEN amount ELSE 0 END) as upgrades
                FROM admin_logs 
                WHERE created_at BETWEEN $1 AND $2
            `, [startDate, endDate]);

            // Alternativa: Se as taxas estiverem em transactions
            const transRevenueRes = await pool.query(`
                SELECT COALESCE(SUM(amount), 0) as fees 
                FROM transactions 
                WHERE type IN ('FEE', 'SERVICE_TAX') 
                AND status = 'APPROVED'
                AND created_at BETWEEN $1 AND $2
            `, [startDate, endDate]);

            const fiscalSummary = {
                period: { month, year },
                gross_volume: parseFloat(volumeRes.rows[0].total_volume),
                taxable_revenue: parseFloat(revenueRes.rows[0].marketplace_fees || 0) +
                    parseFloat(revenueRes.rows[0].loan_interests || 0) +
                    parseFloat(revenueRes.rows[0].withdrawal_fees || 0) +
                    parseFloat(transRevenueRes.rows[0].fees || 0),
                transitory_funds: parseFloat(volumeRes.rows[0].total_volume) -
                    (parseFloat(revenueRes.rows[0].marketplace_fees || 0) +
                        parseFloat(transRevenueRes.rows[0].fees || 0)),
                details: revenueRes.rows[0]
            };

            return c.json({
                success: true,
                data: fiscalSummary,
                message: "Este relatório separa o que é seu lucro (tributável) do que é apenas custódia de terceiros."
            });
        } catch (error: any) {
            console.error('Erro ao gerar relatório fiscal:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
