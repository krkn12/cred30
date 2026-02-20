import { Context } from 'hono';
import { z } from 'zod'; // Import zod here as schemas will be moved or redefined
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { CacheService, addCacheHeaders } from '../../../infrastructure/cache/memory-cache.service';
import { QUOTA_PRICE, QUOTA_SHARE_VALUE, LOGISTICS_SUSTAINABILITY_FEE_RATE } from '../../../shared/constants/business.constants';
import { executeInTransaction, processTransactionApproval } from '../../../domain/services/transaction.service';
import { distributeProfits } from '../../../application/services/profit-distribution.service';
// Removido: import mercadopago.service (gateway desativado)
import { PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Schemas (Moved from router)
export const createCostSchema = z.object({
    description: z.string().min(3),
    amount: z.number().positive(),
    isRecurring: z.boolean().default(true),
    category: z.enum(['FISCAL', 'OPERATIONAL', 'MIXED']).default('MIXED'),
});

// Schema simulateMpSchema removido (gateway desativado)

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
     * AUDITORIA CONTÁBIL (Debug)
     */
    static async getAuditData(c: Context) {
        try {
            const pool = getDbPool(c);

            // 1. Saldos de Usuários
            const users = await pool.query(`
                SELECT id, name, balance::numeric, score, role, is_seller 
                FROM users ORDER BY id
            `);
            let totalUserBalances = 0;
            const usersData = users.rows.map(u => {
                const bal = parseFloat(u.balance);
                totalUserBalances += bal;
                return { ...u, balance: bal };
            });

            // 2. Reservas
            const sysConfig = await pool.query(`
                SELECT key, value FROM system_config 
                WHERE key IN (
                    'system_balance', 'tax_reserve', 'operational_reserve', 
                    'owner_reserve', 'stability_fund', 'corporate_investment',
                    'total_fees_collected'
                ) ORDER BY key
            `);
            let totalReserves = 0;
            const reservesData: any = {};
            sysConfig.rows.forEach(r => {
                const val = parseFloat(r.value) || 0;
                reservesData[r.key] = val;
                if (['tax_reserve', 'operational_reserve', 'owner_reserve', 'stability_fund', 'corporate_investment'].includes(r.key)) {
                    totalReserves += val;
                }
            });

            // 3. Transações
            const transactions = await pool.query(`
                SELECT id, user_id, type, amount::numeric, description, status, created_at
                FROM transactions ORDER BY created_at ASC
            `);
            let totalDeposits = 0;
            let totalWithdrawals = 0;
            let totalFees = 0;
            transactions.rows.forEach(t => {
                const amt = parseFloat(t.amount);
                if (t.type === 'DEPOSIT' && t.status === 'COMPLETED') totalDeposits += amt;
                if (t.type === 'WITHDRAWAL' && t.status === 'COMPLETED') totalWithdrawals += amt;
                if (t.type === 'FEE' || t.type === 'PLATFORM_FEE') totalFees += amt;
            });

            // 4. Vendas PDV
            const sales = await pool.query(`
                SELECT id, user_id, sale_number, total::numeric, payment_method, 
                       customer_name, change_amount::numeric, created_at
                FROM pdv_sales ORDER BY created_at ASC
            `);
            let totalSales = 0;
            sales.rows.forEach(s => totalSales += parseFloat(s.total));

            // 5. Empréstimos
            const loans = await pool.query(`
                SELECT id, user_id, amount::numeric, total_with_interest::numeric, 
                       status, installments, origin, created_at
                FROM loans ORDER BY created_at ASC
            `);
            let totalLoansActive = 0;
            loans.rows.forEach(l => {
                if (l.status === 'APPROVED' || l.status === 'ACTIVE') totalLoansActive += parseFloat(l.amount);
            });

            // 6. Cotas
            const quotas = await pool.query(`
                SELECT id, user_id, amount::numeric, status, created_at
                FROM quotas ORDER BY created_at ASC
            `);
            let totalQuotas = 0;
            quotas.rows.forEach(q => {
                if (q.status === 'ACTIVE') totalQuotas += parseFloat(q.amount);
            });

            // Resumo Final
            const dinheiroNoSistema = totalUserBalances + totalReserves + totalQuotas;
            const dinheiroQueEntrou = totalDeposits - totalWithdrawals;
            const diferenca = dinheiroNoSistema - dinheiroQueEntrou;

            return c.json({
                success: true,
                audit: {
                    resumo: {
                        entradas_depositos: totalDeposits,
                        saidas_saques: totalWithdrawals,
                        dinheiro_que_entrou_liquido: dinheiroQueEntrou,

                        saldos_usuarios: totalUserBalances,
                        reservas: totalReserves,
                        cotas_ativas: totalQuotas,
                        dinheiro_no_sistema: dinheiroNoSistema,

                        diferenca_inconsistencia: diferenca,
                        status: Math.abs(diferenca) < 0.01 ? 'EQUILIBRADO' : 'INCONSISTENTE'
                    },
                    detalhes: {
                        reservas: reservesData,
                        vendas_pdv_total: totalSales,
                        emprestimos_ativos_total: totalLoansActive,
                        taxas_totais: totalFees,
                        usuarios_count: users.rowCount,
                        transacoes_count: transactions.rowCount
                    },
                    dados_brutos: {
                        users: usersData,
                        transactions: transactions.rows, // Cuidado com tamanho
                        sales: sales.rows
                    }
                }
            });

        } catch (error: any) {
            console.error('Erro na auditoria:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Adicionar custo do sistema
     */
    static async addCost(c: Context) {
        try {
            const body = await c.req.json();
            const { description, amount, isRecurring, category } = createCostSchema.parse(body);
            const pool = getDbPool(c);

            await pool.query(
                'INSERT INTO system_costs (description, amount, is_recurring, category) VALUES ($1, $2, $3, $4)',
                [description, amount, isRecurring, category]
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
                const costRes = await client.query('SELECT description, amount, category FROM system_costs WHERE id = $1', [id]);
                if (costRes.rows.length === 0) {
                    throw new Error('Custo não encontrado');
                }
                const cost = costRes.rows[0];
                const amount = parseFloat(cost.amount);
                const category = cost.category || 'MIXED';

                // 2. Buscar configurações e reservas
                const configRes = await client.query('SELECT system_balance, total_tax_reserve, total_operational_reserve FROM system_config LIMIT 1');
                const config = configRes.rows[0];
                const currentBalance = parseFloat(config.system_balance);
                const taxReserve = parseFloat(config.total_tax_reserve);
                const operationalReserve = parseFloat(config.total_operational_reserve);

                if (currentBalance < amount) {
                    throw new Error('Saldo GLOBAL do sistema insuficiente para realizar este pagamento.');
                }

                // 3. Calcular a dedução por categoria e VALIDAR SALDO DO POTE
                let taxShare = 0;
                let operationalShare = 0;

                if (category === 'FISCAL') {
                    if (taxReserve < amount) {
                        throw new Error(`SALDO INSUFICIENTE: O pote de IMPOSTOS (R$ ${taxReserve.toFixed(2)}) não tem saldo para cobrir este custo de R$ ${amount.toFixed(2)}. Arrecade mais taxas antes de pagar.`);
                    }
                    taxShare = amount;
                } else if (category === 'OPERATIONAL') {
                    if (operationalReserve < amount) {
                        throw new Error(`SALDO INSUFICIENTE: O pote OPERACIONAL (R$ ${operationalReserve.toFixed(2)}) não tem saldo para cobrir este custo de R$ ${amount.toFixed(2)}. O sistema precisa gerar mais receita operacional.`);
                    }
                    operationalShare = amount;
                } else {
                    // MIXED (50/50)
                    taxShare = amount * 0.50;
                    operationalShare = amount - taxShare;

                    if (taxReserve < taxShare || operationalReserve < operationalShare) {
                        throw new Error(`SALDO INSUFICIENTE: Os potes (Fiscal: R$ ${taxReserve.toFixed(2)} | Operacional: R$ ${operationalReserve.toFixed(2)}) não possuem saldo para a divisão 50/50 deste custo.`);
                    }
                }

                // --- PROTEÇÃO DO CAPITAL SOCIAL (LASTRO) ---
                const activeQuotasResult = await client.query(`SELECT COUNT(*) as count FROM quotas WHERE status = 'ACTIVE'`);
                const activeQuotasCount = parseInt(activeQuotasResult.rows[0].count);
                const capitalSocialExigivel = activeQuotasCount * QUOTA_SHARE_VALUE;

                const saldoPosPagamento = currentBalance - amount;

                if (saldoPosPagamento < capitalSocialExigivel) {
                    throw new Error(`Risco de Insolvência. Saldo restante (R$ ${saldoPosPagamento.toFixed(2)}) seria menor que o Capital Social (R$ ${capitalSocialExigivel.toFixed(2)}).`);
                }

                // 4. Executar o desconto nos potes específicos
                await client.query(
                    'UPDATE system_config SET system_balance = system_balance - $1, total_tax_reserve = total_tax_reserve - $2, total_operational_reserve = total_operational_reserve - $3',
                    [amount, taxShare, operationalShare]
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
            const pool = getDbPool(c);
            const refresh = c.req.query('refresh') === 'true';

            // FORÇAR CACHE OFF (DEBUG)
            console.error('🔧 [DEBUG] Invalidando cache SEMPRE...');
            CacheService.invalidateAdminDashboard();

            // NUNCA usar cache (temporário)
            const cachedData = null;

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
            const quotasCountCache = parseInt(activeQuotasResult.rows[0].count);
            const totalQuotasValue = quotasCountCache * QUOTA_PRICE;

            const totalLoanedResult = await pool.query(
                `SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total_loaned
                 FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING', 'ACTIVE')`
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
            config.mutual_reserve = parseFloat(String(config.mutual_reserve || 0));
            config.total_corporate_investment_reserve = parseFloat(String(config.total_corporate_investment_reserve || 0));
            config.credit_guarantee_fund = parseFloat(String(config.credit_guarantee_fund || 0));
            config.courier_price_per_km = parseFloat(String(config.courier_price_per_km || '2.50'));

            const statsResult = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM users) as users_count,
          (SELECT COALESCE(SUM(CAST(balance AS NUMERIC)), 0) FROM users) as total_user_balances,
          (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE') as quotas_count,
          (SELECT COUNT(*) FROM loans WHERE status IN ('PENDING', 'APPROVED', 'PAYMENT_PENDING')) as active_loans_count,
          (SELECT COALESCE(SUM(CAST(total_repayment AS NUMERIC)), 0) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_to_receive,
          (SELECT COALESCE(SUM(amount), 0) FROM system_costs) as total_monthly_costs,
          (SELECT COUNT(*) FROM governance_proposals WHERE status = 'active') as active_proposals_count,
          (SELECT COUNT(*) FROM users WHERE is_protected = TRUE) as protected_users_count
      `);

            const stats = statsResult.rows[0];
            const usersCount = parseInt(stats.users_count);
            const totalUserBalances = parseFloat(stats.total_user_balances);
            const quotasCount = parseInt(stats.quotas_count);
            const activeLoansCount = parseInt(stats.active_loans_count);
            const totalToReceive = parseFloat(stats.total_to_receive);
            const totalMonthlyCosts = parseFloat(stats.total_monthly_costs);
            const activeProposalsCount = parseInt(stats.active_proposals_count || 0);

            const totalInvestedRes = await pool.query(`SELECT COALESCE(SUM(total_invested), 0) as total FROM investments WHERE status = 'ACTIVE'`);
            const totalInvestedValue = parseFloat(totalInvestedRes.rows[0].total);

            // FÓRMULA FINAL JOSIAS: Liquidez Real = (Cotas × 42) - Empréstimos - Investimentos Ativos
            const activeQuotasCount = Number(stats.quotas_count || 0);
            const totalCapitalSocial = activeQuotasCount * QUOTA_SHARE_VALUE; // R$ 42 por cota
            const totalEmprestimos = Number(totalLoaned || 0);

            config.real_liquidity = totalCapitalSocial - totalEmprestimos - totalInvestedValue;

            // LOG DE DEBUG
            console.error('🔍 [LIQUIDEZ] Cotas:', activeQuotasCount, '× R$ 42 = R$', totalCapitalSocial);
            console.error('🔍 [LIQUIDEZ] Empréstimos: R$', totalEmprestimos);
            console.error('🔍 [LIQUIDEZ] Investimentos Ativos: R$', totalInvestedValue);
            console.error('🔍 [LIQUIDEZ] RESULTADO FINAL:', config.real_liquidity);

            // Manter total_reserves para compatibilidade
            const calcTax = Number(config.total_tax_reserve || 0);
            const calcOper = Number(config.total_operational_reserve || 0);
            const calcProfit = Number(config.total_owner_profit || 0);
            const calcMutual = Number(config.mutual_reserve || 0);
            const calcInvest = Number(config.investment_reserve || 0);
            const calcCorp = Number(config.total_corporate_investment_reserve || 0);
            const calcGfc = Number(config.credit_guarantee_fund || 0);
            const calcCosts = Number(totalMonthlyCosts || 0);
            const calcUsers = Number(totalUserBalances || 0);
            config.total_reserves = calcTax + calcOper + calcProfit + calcMutual + calcInvest + calcCorp + calcGfc + calcCosts + calcUsers;
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
                    protectedUsersCount: parseInt(stats.protected_users_count || 0)
                },
            };

            // LOG GIGANTE PARA O JOSIAS VER
            console.error('\n\n========================================');
            console.error('🚨🚨🚨 RETORNANDO LIQUIDEZ PARA O FRONTEND 🚨🚨🚨');
            console.error('========================================');
            console.error('VALOR DA LIQUIDEZ:', config.real_liquidity);
            console.error('========================================\n\n');

            // Salvar no cache
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

            // Limpar cache para atualização imediata
            CacheService.invalidateAdminDashboard();

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

            if (result.success) {
                CacheService.invalidateAdminDashboard();
            }

            if (!result.success) {
                return c.json(result, 400);
            }

            return c.json(result);
        } catch (error) {
            console.error('Erro ao distribuir dividendos:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    // Função simulatePayment removida (gateway Mercado Pago desativado)

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

            // Limpar cache para atualização imediata
            CacheService.invalidateAdminDashboard();

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
            CacheService.invalidateAdminDashboard();

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
            const month = c.req.query('month');
            const year = c.req.query('year');
            const isAllTime = month === '0' || !month;

            let dateFilter = '';
            let params: any[] = [];

            if (!isAllTime) {
                const startDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
                const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0] + ' 23:59:59';
                dateFilter = `AND created_at BETWEEN $1 AND $2`;
                params = [startDate, endDate];
            }

            // 1. Entradas Totais (Gross Inflow) - Dinheiro NOVO entrando
            // Apenas Depósitos e Pagamentos via PIX externo.
            // Uso de saldo (Circular) NÃO deve somar aqui para evitar duplicidade.
            const inflowRes = await pool.query(`
                SELECT COALESCE(SUM(ABS(amount)), 0) as total_inflow
                FROM transactions 
                WHERE status = 'APPROVED' 
                AND (
                    type = 'DEPOSIT' 
                    OR (type = 'BUY_QUOTA' AND metadata->>'paymentMethod' = 'pix')
                    OR (type = 'ORDER_PAYMENT' AND metadata->>'paymentMethod' = 'pix')
                )
                ${dateFilter}
            `, params);

            // 2. Saídas Totais (Gross Outflow) - Dinheiro SAINDO do sistema
            // Saques processados
            const outflowRes = await pool.query(`
                SELECT COALESCE(SUM(ABS(amount)), 0) as total_outflow
                FROM transactions
                WHERE status IN ('APPROVED', 'COMPLETED', 'PAID')
                AND type IN ('WITHDRAWAL')
                ${dateFilter}
            `, params);

            // 3. Distribuição de Lucros (Dividends Paid)
            const dividendsRes = await pool.query(`
                SELECT COALESCE(SUM(amount), 0) as total_dividends
                FROM transactions
                WHERE status = 'APPROVED'
                AND type = 'DIVIDEND'
                ${dateFilter}
            `, params);

            // 4. Receita de Marketplace (Faturamento)
            const marketplaceRes = await pool.query(`
                SELECT COALESCE(SUM(fee_amount), 0) as marketplace_fees
                FROM marketplace_orders
                WHERE status != 'CANCELED'
                ${dateFilter}
            `, params);

            // 5. Taxas Diretas (Faturamento)
            const feesRes = await pool.query(`
                SELECT COALESCE(SUM(amount), 0) as direct_fees
                FROM transactions
                WHERE type IN ('FEE', 'WITHDRAWAL_FEE', 'SERVICE_TAX')
                AND status = 'APPROVED'
                ${dateFilter}
            `, params);

            // 6. Lucro Logístico (Faturamento)
            const logisticsProfitRes = await pool.query(`
                SELECT COALESCE(SUM(delivery_fee * ${LOGISTICS_SUSTAINABILITY_FEE_RATE}), 0) as logistics_profit
                FROM marketplace_orders
                WHERE delivery_status = 'DELIVERED'
                ${dateFilter}
            `, params);

            // 8. Taxas de Cotas (SVA - Metadata serviceFee)
            const quotaFeesRes = await pool.query(`
                SELECT COALESCE(SUM(CAST(metadata ->> 'serviceFee' AS NUMERIC)), 0) as quota_fees
                FROM transactions
                WHERE type = 'BUY_QUOTA'
                AND status = 'APPROVED'
                ${dateFilter}
            `, params);

            // 9. Receita de Juros de Empréstimos (Metadata interestAmount)
            const loanInterestRes = await pool.query(`
            SELECT COALESCE(SUM(CAST(metadata ->> 'interestAmount' AS NUMERIC)), 0) as loan_revenue
            FROM transactions
            WHERE type = 'LOAN_PAYMENT'
            AND status IN('COMPLETED', 'APPROVED')
            ${dateFilter}
        `, params);

            // 10. Receita de Educação (Faturamento - 10% de comissão)
            const educationRevenueRes = await pool.query(`
            SELECT COALESCE(SUM(amount_paid * 0.10), 0) as education_revenue
            FROM course_purchases
            WHERE 1=1
            ${dateFilter}
        `, params);

            // 11. Receita de Vídeos Promocionais (Faturamento - 65% de taxa de serviço)
            const promoVideosRevenueRes = await pool.query(`
            SELECT COALESCE(SUM(ABS(amount) * 0.65), 0) as promo_revenue
            FROM transactions
            WHERE type = 'PROMO_VIDEO_BUDGET'
            AND status = 'COMPLETED'
            ${dateFilter}
        `, params);

            // 12. Receita de Monetização (PRO, Badges, etc. - 20% de taxa)
            const monetizationRevenueRes = await pool.query(`
            SELECT COALESCE(SUM(ABS(amount) * 0.20), 0) as monetization_revenue
            FROM transactions
            WHERE type IN ('MEMBERSHIP_UPGRADE', 'PREMIUM_PURCHASE', 'REPUTATION_CONSULT', 'PROTECTION_PURCHASE')
            AND status = 'APPROVED'
            ${dateFilter}
        `, params);

            // 13. Caixa de Terceiros Real (Soma de todos os saldos de usuários)
            const custodyRes = await pool.query(`SELECT COALESCE(SUM(balance), 0) as total_custody FROM users`);
            const totalCustody = parseFloat(custodyRes.rows[0].total_custody);

            // 7. Configurações Gerais
            const configResult = await pool.query('SELECT profit_pool, total_owner_profit, system_balance FROM system_config LIMIT 1');
            const config = configResult.rows[0] || {};

            // Cálculos Finais
            const totalInflow = parseFloat(inflowRes.rows[0].total_inflow);
            const totalOutflow = parseFloat(outflowRes.rows[0].total_outflow);
            const totalDividends = parseFloat(dividendsRes.rows[0].total_dividends);

            const revenueFromMarketplace = parseFloat(marketplaceRes.rows[0].marketplace_fees);
            const revenueFromFees = parseFloat(feesRes.rows[0].direct_fees);
            const revenueFromLogistics = parseFloat(logisticsProfitRes.rows[0].logistics_profit);
            const revenueFromQuotas = parseFloat(quotaFeesRes.rows[0].quota_fees);
            const revenueFromLoans = parseFloat(loanInterestRes.rows[0].loan_revenue);
            const revenueFromEducation = parseFloat(educationRevenueRes.rows[0].education_revenue);
            const revenueFromPromoVideos = parseFloat(promoVideosRevenueRes.rows[0].promo_revenue);
            const revenueFromMonetization = parseFloat(monetizationRevenueRes.rows[0].monetization_revenue);

            const grossRevenue = revenueFromMarketplace + revenueFromFees + revenueFromLogistics + revenueFromQuotas + revenueFromLoans + revenueFromEducation + revenueFromPromoVideos + revenueFromMonetization;
            const netProfit = grossRevenue - totalDividends;

            const fiscalSummary = {
                period: isAllTime ? 'Histórico Completo' : `${month}/${year}`,

                // Fluxo de Caixa
                total_inflow: totalInflow,
                total_outflow: totalOutflow,

                // Resultado Econômico
                gross_revenue: grossRevenue,
                total_dividends: totalDividends,
                net_profit: netProfit,

                // Detalhamento
                details: {
                    marketplace_commissions: revenueFromMarketplace,
                    logistics_margin: revenueFromLogistics,
                    withdrawal_fees: revenueFromFees,
                    quota_maintenance_fees: revenueFromQuotas,
                    loan_interest_revenue: revenueFromLoans,
                    education_revenue: revenueFromEducation,
                    promo_videos_revenue: revenueFromPromoVideos,
                    monetization_revenue: revenueFromMonetization,
                    total_owner_profit: parseFloat(config.total_owner_profit || 0),
                    system_balance: parseFloat(config.system_balance || 0),
                    volume_transitory: totalCustody // Sincronizado com os saldos REAIS
                },

                legal_notice: "Relatório de intermediação de negócios e gestão de custódia de terceiros (Não tributável sobre o capital social)."
            };

            return c.json({
                success: true,
                data: fiscalSummary,
                message: isAllTime ? "Relatório consolidado." : "Relatório mensal."
            });
        } catch (error: any) {
            console.error('Erro ao gerar relatório fiscal:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
