import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { PoolClient } from 'pg';
import { authMiddleware, adminMiddleware, attendantMiddleware } from '../middleware/auth.middleware';
import { auditMiddleware } from '../../../infrastructure/logging/audit.middleware';
import { adminRateLimit } from '../middleware/rate-limit.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import {
  QUOTA_PRICE,
  QUOTA_SHARE_VALUE,
  QUOTA_ADM_FEE,
  USE_ASAAS
} from '../../../shared/constants/business.constants';
import { executeInTransaction, updateUserBalance, createTransaction, processTransactionApproval } from '../../../domain/services/transaction.service';
import { distributeProfits } from '../../../application/services/profit-distribution.service';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';
import { createPayout, detectPixKeyType } from '../../../infrastructure/gateways/asaas.service';
import { CacheService, addCacheHeaders } from '../../../infrastructure/cache/memory-cache.service';
import { calculateGatewayCost } from '../../../shared/utils/financial.utils';
import { updateTransactionStatus } from '../../../domain/services/transaction.service';
import { runAutoLiquidation } from '../../../application/services/auto-liquidation.service';
import { simulatePaymentApproval } from '../../../infrastructure/gateways/mercadopago.service';

interface PaymentApprovalResult {
  success: boolean;
  principalAmount: number;
  interestAmount: number;
}

const adminRoutes = new Hono();

// Aplicar middlewares a todas as rotas de admin
adminRoutes.use('*', authMiddleware);
adminRoutes.use('*', adminRateLimit);

// Esquema de validação para atualização de saldo do sistema
const updateBalanceSchema = z.object({
  newBalance: z.number(),
});

// Esquema de validação para adição ao pool de lucros
const updateProfitSchema = z.object({
  amountToAdd: z.number(),
});

// Esquema de validação para aprovação/rejeição
const actionSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'string') {
      return val; // Manter como string (UUID)
    }
    return val.toString(); // Converter number para string
  }).refine((val) => typeof val === 'string', {
    message: "ID deve ser uma string (UUID) válida"
  }),
  type: z.enum(['TRANSACTION', 'LOAN']),
  action: z.enum(['APPROVE', 'REJECT']),
});

const simulateMpSchema = z.object({
  paymentId: z.coerce.number(),
  transactionId: z.string()
});

const payoutActionSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(val => val.toString()),
  type: z.enum(['TRANSACTION', 'LOAN']),
});

const createReferralCodeSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  maxUses: z.number().int().min(1).optional().nullable(),
});

const addQuotaSchema = z.object({
  email: z.string().email(),
  quantity: z.number().int().positive(),
  reason: z.string().optional()
});

const createCostSchema = z.object({
  description: z.string().min(3),
  amount: z.number().positive(),
  isRecurring: z.boolean().default(true),
});

// Listar custos do sistema
adminRoutes.get('/costs', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);
    const result = await pool.query('SELECT * FROM system_costs ORDER BY created_at DESC');
    return c.json({ success: true, data: result.rows });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Adicionar custo do sistema
adminRoutes.post('/costs', adminMiddleware, auditMiddleware('ADD_COST', 'SYSTEM'), async (c) => {
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
});

// Remover custo do sistema
adminRoutes.delete('/costs/:id', adminMiddleware, auditMiddleware('DELETE_COST', 'SYSTEM'), async (c) => {
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
});

// Pagamento de custo do sistema
adminRoutes.post('/costs/:id/pay', adminMiddleware, auditMiddleware('PAY_COST', 'SYSTEM'), async (c) => {
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

      // 2. Subtrair do saldo do sistema
      const configRes = await client.query('SELECT system_balance FROM system_config LIMIT 1');
      if (parseFloat(configRes.rows[0].system_balance) < amount) {
        throw new Error('Saldo do sistema insuficiente para realizar este pagamento.');
      }

      await client.query('UPDATE system_config SET system_balance = system_balance - $1', [amount]);

      // 3. Remover o custo (como solicitado: "as dívidas somem")
      await client.query('DELETE FROM system_costs WHERE id = $1', [id]);

      return { description: cost.description, amount: amount };
    });

    if (!result.success) return c.json({ success: false, message: result.error }, 400);

    return c.json({ success: true, message: `Pagamento de "${result.data?.description}" realizado com sucesso!` });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Histórico Financeiro do Admin (Extrato) com Paginação
adminRoutes.get('/finance-history', adminMiddleware, async (c) => {
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
});

// Dashboard administrativo (com cache de 2 minutos)
adminRoutes.get('/dashboard', adminMiddleware, async (c) => {
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

      // Buscar novamente
      const newConfigResult = await pool.query('SELECT * FROM system_config LIMIT 1');
      config = newConfigResult.rows[0];
    }

    // Calcular caixa operacional baseado em cotas ATIVAS APENAS
    // Caixa = (Total de cotas ATIVAS * QUOTA_PRICE) - (Valor total emprestado)
    const activeQuotasResult = await pool.query(
      `SELECT COUNT(*) as count FROM quotas WHERE status = 'ACTIVE'`
    );
    const activeQuotasCount = parseInt(activeQuotasResult.rows[0].count);
    const totalQuotasValue = activeQuotasCount * QUOTA_PRICE;

    // Calcular valor total emprestado (apenas empréstimos ATIVOS, não pagos)
    const totalLoanedResult = await pool.query(
      `SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total_loaned
       FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')`
    );
    const totalLoaned = parseFloat(totalLoanedResult.rows[0].total_loaned);

    // Calcular "Saúde Financeira" Teórica (Deveria existir = Capital - Saídas)
    // Brindes agora são considerados entradas de dinheiro (capitalização do sistema)
    const operationalCash = totalQuotasValue - totalLoaned;

    // Converter valores numéricos para garantir consistência e evitar strings
    config.system_balance = parseFloat(String(config.system_balance || 0));
    config.profit_pool = parseFloat(String(config.profit_pool || 0));
    config.quota_price = parseFloat(String(config.quota_price || 0));
    config.total_gateway_costs = parseFloat(String(config.total_gateway_costs || 0));
    config.total_manual_costs = parseFloat(String(config.total_manual_costs || 0));
    config.total_tax_reserve = parseFloat(String(config.total_tax_reserve || 0));
    config.total_operational_reserve = parseFloat(String(config.total_operational_reserve || 0));
    config.total_owner_profit = parseFloat(String(config.total_owner_profit || 0));
    config.investment_reserve = parseFloat(String(config.investment_reserve || 0));

    // Buscar totais e métricas financeiras de forma otimizada (query única)
    const statsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COALESCE(SUM(CAST(balance AS NUMERIC)), 0) FROM users) as total_user_balances,
        (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE') as quotas_count,
        (SELECT COUNT(*) FROM loans WHERE status IN ('PENDING', 'APPROVED', 'PAYMENT_PENDING')) as active_loans_count,
        (SELECT COALESCE(SUM(CAST(total_repayment AS NUMERIC)), 0) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_to_receive,
        (SELECT COALESCE(SUM(amount), 0) FROM system_costs) as total_monthly_costs,
        (SELECT COUNT(*) FROM voting_proposals WHERE status = 'ACTIVE') as active_proposals_count
    `);

    const stats = statsResult.rows[0];
    const usersCount = parseInt(stats.users_count);
    const totalUserBalances = parseFloat(stats.total_user_balances);
    const quotasCount = parseInt(stats.quotas_count);
    const activeLoansCount = parseInt(stats.active_loans_count);
    const totalToReceive = parseFloat(stats.total_to_receive);
    const totalMonthlyCosts = parseFloat(stats.total_monthly_costs);
    const activeProposalsCount = parseInt(stats.active_proposals_count || 0);

    // Calcular detalhamento de liquidez para o dashboard
    // Liquidez Real = (Saldo em Conta) - (Saldos dos Usuários) - (Reservas Fixas) - (Custos do Mês)
    // O profit_pool NÃO é subtraído aqui porque ele é uma distribuição futura, não uma dívida imediata exigível (saque).
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

    // DEBUG: Informação detalhada de caixa
    console.log('DEBUG - Saúde Financeira:', {
      caixaBruto: config.system_balance,
      saldosUsuarios: totalUserBalances,
      reservasTotal: totalReservesForRealLiquidity,
      liquidezReal: config.real_liquidity,
      caixaTeorico: operationalCash,
      custosFixos: totalMonthlyCosts
    });

    // Preparar dados para resposta e cache
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

    // Salvar no cache por 2 minutos
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
});

// Rota obsoleta - Caixa operacional agora é calculado automaticamente
// Mantida para compatibilidade, mas retorna mensagem informativa
// Painel de Monitoramento de Saúde do Sistema
adminRoutes.get('/metrics/health', attendantMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);
    const start = Date.now();

    // 1. Latência do Banco de Dados
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - start;

    // 2, 3 e 4. Estatísticas Consolidadas (Performance)
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

    // 5. Recursos do Sistema (Node.js)
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
});

adminRoutes.post('/system-balance', adminMiddleware, async (c) => {
  return c.json({
    success: false,
    message: 'Caixa operacional agora é calculado automaticamente baseado nas cotas ATIVAS e empréstimos ativos.',
    info: 'Valor = (Total de cotas ATIVAS × R$ 50) - (Total emprestado)'
  }, 400);
});

// Adicionar lucro ao pool
// Adicionar lucro ao pool (e distribuir automaticamente agora)
adminRoutes.post('/profit-pool', adminMiddleware, auditMiddleware('MANUAL_PROFIT_ADD', 'SYSTEM_CONFIG'), async (c) => {
  try {
    const body = await c.req.json();
    let amountToAdd: number | undefined = undefined;

    // Tentar pegar do schema validado OU do corpo direto (fallback)
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

    // Executar dentro de transação para garantir consistência: Adiciona e Distribui
    await executeInTransaction(pool, async (client) => {
      // 1. Adicionar ao pool de lucros E ao saldo real (pois é dinheiro novo entrando)
      await client.query(
        'UPDATE system_config SET profit_pool = profit_pool + $1, system_balance = system_balance + $1',
        [amountVal]
      );

      // 2. Registrar auditoria manual
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
});

// Adicionar cotas manualmente para um usuário (Gift/Bonus)
adminRoutes.post('/users/add-quota', adminMiddleware, auditMiddleware('MANUAL_ADD_QUOTA', 'QUOTA'), async (c) => {
  try {
    const body = await c.req.json();
    const { email, quantity, reason } = addQuotaSchema.parse(body);

    const pool = getDbPool(c);

    const result = await executeInTransaction(pool, async (client) => {
      // 1. Encontrar usuário
      const userRes = await client.query('SELECT id, name FROM users WHERE email = $1', [email]);
      if (userRes.rows.length === 0) {
        throw new Error('Usuário não encontrado com este email');
      }
      const user = userRes.rows[0];

      // 2. Inserir Cotas
      for (let i = 0; i < quantity; i++) {
        await client.query(
          `INSERT INTO quotas (user_id, purchase_price, current_value, purchase_date, status)
           VALUES ($1, $2, $3, $4, 'ACTIVE')`,
          [user.id, QUOTA_SHARE_VALUE, QUOTA_SHARE_VALUE, new Date()]
        );
      }

      // 3. Registrar a entrada de capital das cotas presenteadas (Admin aportando/capitalizando)
      const giftTotal = quantity * QUOTA_PRICE;
      const giftShareValue = quantity * QUOTA_SHARE_VALUE;
      const giftAdmFee = quantity * QUOTA_ADM_FEE;

      await client.query(
        'UPDATE system_config SET system_balance = system_balance + $1',
        [giftTotal] // O sistema recebe o valor total (como se o admin estivesse injetando capital)
      );

      // 4. Atualizar Score do Usuário (Benefício da Cota)
      await updateScore(client, user.id, SCORE_REWARDS.QUOTA_PURCHASE * quantity, `Ganhou ${quantity} cotas (Gift Admin)`);

      // 3. Registrar Log no histórico do usuário
      await createTransaction(
        client,
        user.id,
        'ADMIN_GIFT',
        0,
        `Recebeu ${quantity} cotas manualmente do Admin. Motivo: ${reason || 'Bônus Administrativo'}`,
        'COMPLETED',
        { quantity, reason, adminAction: true }
      );

      return { user: user.name };
    });

    if (!result.success) {
      return c.json({ success: false, message: result.error }, 400);
    }

    return c.json({
      success: true,
      message: `${quantity} cotas adicionadas para ${result.data?.user} com sucesso!`
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }
    return c.json({ success: false, message: error instanceof Error ? error.message : 'Erro interno' }, 500);
  }
});

// Processar ação administrativa (aprovar/rejeitar)
// Processar ação administrativa (aprovar/rejeitar)
adminRoutes.post('/process-action', adminMiddleware, auditMiddleware('PROCESS_ACTION', 'TRANSACTION_LOAN'), async (c) => {
  try {
    const body = await c.req.json();
    const { id, type, action } = actionSchema.parse(body);

    const pool = getDbPool(c);

    // Executar dentro de transação para garantir consistência
    const result = await executeInTransaction(pool, async (client) => {
      if (type === 'TRANSACTION') {
        return await processTransactionApproval(client, id, action);
      }
      throw new Error('Tipo de ação não reconhecido');
    });

    if (!result.success) {
      return c.json({
        success: false,
        message: result.error
      }, 400);
    }

    return c.json({
      success: true,
      message: `${action === 'APPROVE' ? 'Aprovado' : 'Rejeitado'} com sucesso!`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, 500);
  }
});

// Listar Transações Pendentes de Aprovação (Entradas de PIX Manual)
adminRoutes.get('/pending-transactions', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);

    const result = await pool.query(
      `SELECT t.*, u.name as user_name, u.email as user_email, u.pix_key as user_pix
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.status = 'PENDING' 
       AND t.type IN ('QUOTA_PURCHASE', 'LOAN_PAYMENT', 'UPGRADE_PRO', 'DEPOSIT', 'ADMIN_GIFT')
       ORDER BY t.created_at DESC`
    );

    return c.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Erro ao buscar transações pendentes:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Listar Fila de Pagamentos (Payout Queue)
adminRoutes.get('/payout-queue', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);

    // Buscar transações (saques) aguardando pagamento
    const transactionsResult = await pool.query(
      `SELECT t.*, u.name as user_name, u.email as user_email, u.pix_key as user_pix, u.score as user_score,
              (SELECT COUNT(*) FROM quotas q WHERE q.user_id = t.user_id AND q.status = 'ACTIVE') as user_quotas
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.payout_status = 'PENDING_PAYMENT'
       ORDER BY user_quotas DESC, user_score DESC, t.created_at ASC`
    );



    return c.json({
      success: true,
      data: {
        transactions: transactionsResult.rows,
        loans: [] // Retornar vazio para compatibilidade
      }
    });
  } catch (error) {
    console.error('Erro ao buscar fila de pagamentos:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Confirmar Pagamento Efetuado (PIX enviado)
adminRoutes.post('/confirm-payout', adminMiddleware, auditMiddleware('CONFIRM_PAYOUT', 'TRANSACTION_LOAN'), async (c) => {
  console.log('[CONFIRM-PAYOUT] Iniciando...');
  try {
    const body = await c.req.json();
    console.log('[CONFIRM-PAYOUT] Body recebido:', body);
    const { id, type } = payoutActionSchema.parse(body);
    console.log('[CONFIRM-PAYOUT] Dados validados - ID:', id, 'Type:', type);
    const pool = getDbPool(c);

    console.log('[CONFIRM-PAYOUT] Iniciando transação...');
    const txResult = await executeInTransaction(pool, async (client) => {
      if (type === 'TRANSACTION') {
        // Buscar dados da transação e do usuário
        const txResult = await client.query(
          `SELECT t.user_id, t.amount, t.metadata, u.pix_key, u.name, u.email
           FROM transactions t
           JOIN users u ON t.user_id = u.id
           WHERE t.id = $1`,
          [id]
        );

        if (txResult.rows.length === 0) {
          throw new Error('Transação não encontrada');
        }

        const { user_id, amount, metadata, pix_key, name } = txResult.rows[0];
        const netAmount = metadata?.netAmount || parseFloat(amount);
        const pixKeyToUse = metadata?.pixKey || pix_key;

        console.log('[CONFIRM-PAYOUT] Transação encontrada:', { id, netAmount, pixKeyToUse });

        if (!pixKeyToUse) {
          throw new Error('Usuário não possui chave PIX cadastrada');
        }

        // Tentar enviar PIX automaticamente via Asaas (apenas se USE_ASAAS for true)
        let payoutResult = null;
        let payoutError = null;

        if (USE_ASAAS) {
          try {
            const pixKeyType = detectPixKeyType(pixKeyToUse);
            console.log('[CONFIRM-PAYOUT] Chamando createPayout...');
            payoutResult = await createPayout({
              pixKey: pixKeyToUse,
              pixKeyType,
              amount: netAmount,
              description: `Saque Cred30 - ${name?.split(' ')[0] || 'Cliente'}`
            });

            console.log('[PAYOUT ASAAS] Sucesso:', payoutResult);
          } catch (err: any) {
            console.error('[PAYOUT ASAAS] Erro:', err);
            payoutError = err.message;
          }
        } else {
          console.log('[CONFIRM-PAYOUT] Modo manual ativo. Pulando Asaas e marcando como pago manualmente.');
          // No modo manual, consideramos que o administrador já fez o PIX antes de clicar no botão
          payoutResult = { id: 'MANUAL_' + Date.now(), status: 'CONFIRMED' };
        }

        // Atualizar status do pagamento
        const payoutStatus = payoutResult ? 'PAID' : 'PENDING_MANUAL';
        console.log('[CONFIRM-PAYOUT] Atualizando status para:', payoutStatus);

        await client.query(
          `UPDATE transactions 
           SET payout_status = $1, 
               processed_at = $2, 
               metadata = metadata || $3::jsonb 
           WHERE id = $4`,
          [
            payoutStatus,
            new Date(),
            JSON.stringify({
              asaas_transfer_id: payoutResult?.id,
              asaas_transfer_status: payoutResult?.status,
              payout_error: payoutError,
              payout_method: payoutResult ? 'AUTOMATIC' : 'MANUAL_PENDING'
            }),
            id
          ]
        );

        console.log('[CONFIRM-PAYOUT] Transação atualizada com sucesso!');

        // Criar notificação
        const notifMessage = payoutResult
          ? `O valor de R$ ${netAmount.toFixed(2)} foi enviado para sua chave PIX automaticamente! Que tal avaliar sua experiência?`
          : `Seu saque de R$ ${netAmount.toFixed(2)} está sendo processado manualmente. Em breve será enviado para sua chave PIX.`;

        await client.query(
          `INSERT INTO notifications (user_id, title, message, type, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            user_id,
            payoutResult ? '💸 Seu saque foi processado!' : '⏳ Saque em processamento',
            notifMessage,
            'PAYOUT_COMPLETED',
            JSON.stringify({
              transactionId: id,
              amount: netAmount,
              requiresReview: !!payoutResult,
              automatic: !!payoutResult
            }),
            new Date()
          ]
        );

        if (payoutError) {
          throw new Error(`Pagamento registrado mas falhou envio automático: ${payoutError}. Você pode tentar novamente ou fazer manualmente.`);
        }

        return { success: true };
      } else {
        throw new Error('Tipo de confirmação não suportado');
      }
    });

    console.log('[CONFIRM-PAYOUT] Resultado da transação:', txResult);

    if (!txResult.success) {
      console.error('[CONFIRM-PAYOUT] Transação falhou:', txResult.error);
      return c.json({ success: false, message: txResult.error || 'Erro ao processar pagamento' }, 500);
    }

    return c.json({ success: true, message: 'Pagamento processado via PIX automático!' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }
    return c.json({ success: false, message: error instanceof Error ? error.message : 'Erro interno' }, 500);
  }
});

// Distribuir dividendos
// Distribuir dividendos (Endpoint mantido para compatibilidade, mas agora usa o serviço compartilhado)
adminRoutes.post('/distribute-dividends', adminMiddleware, auditMiddleware('DISTRIBUTE_DIVIDENDS', 'SYSTEM_CONFIG'), async (c) => {
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
});

// Rota para atualização de saldo via PIX removida ou em outra seção

// Rota auxiliar para atualizar PIX de empréstimos existentes (temporário)
adminRoutes.post('/fix-loan-pix', adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { loanId, pixKey } = body;

    if (!loanId || !pixKey) {
      return c.json({ success: false, message: 'loanId e pixKey são obrigatórios' }, 400);
    }

    const pool = getDbPool(c);

    const result = await pool.query(
      'UPDATE loans SET pix_key_to_receive = $1 WHERE id = $2 RETURNING id, pix_key_to_receive',
      [pixKey, loanId]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Empréstimo não encontrado' }, 404);
    }

    return c.json({
      success: true,
      message: 'PIX atualizado com sucesso',
      data: {
        loanId: result.rows[0].id,
        pixKey: result.rows[0].pix_key_to_receive
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar PIX do empréstimo:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Aprovar pagamentos de empréstimos pendentes
adminRoutes.post('/approve-payment', adminMiddleware, auditMiddleware('APPROVE_PAYMENT', 'TRANSACTION'), async (c) => {
  try {
    const body = await c.req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return c.json({ success: false, message: 'transactionId é obrigatório' }, 400);
    }

    const pool = getDbPool(c);

    // Executar dentro de transação para garantir consistência
    const result = await executeInTransaction(pool, async (client) => {
      // Buscar transação de pagamento com bloqueio
      const transactionResult = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
        [transactionId, 'PENDING']
      );

      if (transactionResult.rows.length === 0) {
        throw new Error('Transação não encontrada ou já processada');
      }

      const transaction = transactionResult.rows[0];

      // Verificar se é uma transação de pagamento de empréstimo
      if (transaction.type !== 'LOAN_PAYMENT') {
        throw new Error('Transação não é um pagamento de empréstimo');
      }

      // Verificar se metadata já é um objeto ou precisa fazer parse
      let metadata: any = {};
      try {
        // Verificar se metadata já é um objeto
        if (transaction.metadata && typeof transaction.metadata === 'object') {
          metadata = transaction.metadata;
          console.log('DEBUG - Metadata já é objeto:', metadata);
        } else {
          // Se for string, fazer parse
          const metadataStr = String(transaction.metadata || '{}').trim();
          console.log('DEBUG - Metadata da transação (string):', metadataStr);
          if (metadataStr.startsWith('{') || metadataStr.startsWith('[')) {
            metadata = JSON.parse(metadataStr);
            console.log('DEBUG - Metadata parseado:', metadata);
          }
        }
      } catch (error) {
        console.error('Erro ao fazer parse do metadata:', error);
        metadata = {};
      }

      if (!metadata.loanId) {
        throw new Error('Metadata não contém loanId');
      }

      // Buscar empréstimo
      const loanResult = await client.query(
        'SELECT * FROM loans WHERE id = $1 FOR UPDATE',
        [metadata.loanId]
      );

      if (loanResult.rows.length === 0) {
        throw new Error('Empréstimo não encontrado');
      }

      const loan = loanResult.rows[0];

      // Calcular separação entre principal e juros
      const totalRepayment = parseFloat(loan.total_repayment);
      const principalAmount = parseFloat(loan.amount);
      const totalInterest = totalRepayment - principalAmount;

      console.log('DEBUG - Aprovação de pagamento:', {
        transactionId,
        loanId: metadata.loanId,
        totalRepayment,
        principalAmount,
        totalInterest,
        paymentType: metadata.paymentType
      });

      // Separar valores baseado no tipo de pagamento
      if (metadata.paymentType === 'full_payment') {
        // Pagamento completo do empréstimo
        // Calcular custo do gateway se não for via saldo
        let gatewayCost = 0;
        if (!metadata.useBalance) {
          const paymentMethod = metadata.paymentMethod || 'pix';
          const baseAmount = metadata.baseAmount ? parseFloat(metadata.baseAmount) : principalAmount + totalInterest;
          gatewayCost = calculateGatewayCost(baseAmount, paymentMethod);

          await client.query(
            'UPDATE transactions SET gateway_cost = $1 WHERE id = $2',
            [gatewayCost, transaction.id]
          );

          await client.query(
            'UPDATE system_config SET total_gateway_costs = total_gateway_costs + $1',
            [gatewayCost]
          );
        }

        // Devolver principal ao sistema
        // Se for pagamento externo, o principal vem com a taxa inclusa? 
        // Não, o system_balance deve aumentar pelo principal. O lucro de juros deve aumentar pelo juro.
        // Mas se houve custo de gateway, quem paga?
        // Se for PIX, o sistema absorve (diminui system_balance).
        // Se for CARTÃO, o usuário pagou extra (transaction.amount > baseAmount).

        await client.query(
          'UPDATE system_config SET system_balance = system_balance + $1 - $2',
          [principalAmount, metadata.useBalance ? 0 : gatewayCost]
        );

        // Adicionar juros ao pool de lucros
        await client.query(
          'UPDATE system_config SET profit_pool = profit_pool + $1',
          [totalInterest]
        );

        // Marcar empréstimo como PAGO
        await client.query(
          'UPDATE loans SET status = $1 WHERE id = $2',
          ['PAID', metadata.loanId]
        );

        console.log('DEBUG - Pagamento completo processado (100% juros para pool):', {
          principalReturned: principalAmount,
          totalInterest,
          totalToProfit: totalInterest
        });

      } else if (metadata.paymentType === 'installment' && metadata.installmentAmount) {
        // Pagamento de parcela individual
        const installmentAmount = parseFloat(metadata.installmentAmount);

        // Calcular proporção de principal e juros na parcela
        const principalPortion = installmentAmount * (principalAmount / totalRepayment);
        const interestPortion = installmentAmount - principalPortion;

        // Enviar 100% dos juros da parcela para o pool
        const interestForProfit = interestPortion;

        // Devolver parte do principal ao caixa operacional descontando o custo do gateway
        const paymentMethod = metadata.paymentMethod || 'pix';
        const baseAmount = metadata.baseAmount ? parseFloat(metadata.baseAmount) : installmentAmount;
        const gatewayCost = calculateGatewayCost(baseAmount, paymentMethod);

        // Atualizar transação com o custo (apenas uma vez se múltiplos blocos lerem)
        await client.query(
          'UPDATE transactions SET gateway_cost = $1 WHERE id = $2',
          [gatewayCost, transaction.id]
        );

        // Subtrair do caixa operacional e registrar custo total
        await client.query(
          'UPDATE system_config SET system_balance = system_balance + $1 - $2, total_gateway_costs = total_gateway_costs + $2',
          [principalPortion, gatewayCost]
        );

        console.log('DEBUG - Parcela processada:', {
          installmentAmount,
          principalPortion,
          interestPortion,
          gatewayCost
        });

        // Registrar pagamento da parcela na tabela de installments (IMPORTANTE: PIX não registra antes)
        // O use_balance é false pois se chegou aqui é aprovação de pagamento externo (não saldo)
        await client.query(
          'INSERT INTO loan_installments (loan_id, amount, use_balance, created_at) VALUES ($1, $2, $3, $4)',
          [metadata.loanId, installmentAmount, false, new Date()]
        );

        // Verificar se completou o pagamento do empréstimo
        const paidInstallmentsResult = await client.query(
          'SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as paid_amount FROM loan_installments WHERE loan_id = $1',
          [metadata.loanId]
        );

        const totalPaidAmount = parseFloat(paidInstallmentsResult.rows[0].paid_amount);

        // Se o valor pago for maior ou igual ao total, marcar como PAIDO
        if (totalPaidAmount >= parseFloat(loan.total_repayment)) {
          console.log('DEBUG - Empréstimo quitado com esta parcela!', {
            loanId: metadata.loanId,
            totalPaid: totalPaidAmount,
            totalRepayment: loan.total_repayment
          });

          await client.query(
            'UPDATE loans SET status = $1 WHERE id = $2',
            ['PAID', metadata.loanId]
          );
        }

      } else {
        throw new Error('Tipo de pagamento não reconhecido');
      }

      // Atualizar status da transação para APROVADO
      const updateResult = await updateTransactionStatus(
        client,
        transactionId,
        'PENDING',
        'APPROVED'
      );

      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      let calculatedPrincipal = 0;
      let calculatedInterest = 0;

      if (metadata.paymentType === 'full_payment') {
        calculatedPrincipal = principalAmount;
        calculatedInterest = totalInterest;
      } else if (metadata.paymentType === 'installment' && metadata.installmentAmount) {
        const installmentAmount = parseFloat(metadata.installmentAmount);
        // Calcular proporção de principal e juros na parcela
        calculatedPrincipal = installmentAmount * (principalAmount / totalRepayment);
        calculatedInterest = installmentAmount - calculatedPrincipal;
      }

      console.log('DEBUG - Valores calculados para retorno:', {
        paymentType: metadata.paymentType,
        calculatedPrincipal,
        calculatedInterest,
        installmentAmount: metadata.installmentAmount,
        principalAmount,
        totalInterest,
        totalRepayment,
        loanAmount: loan.amount,
        loanTotalRepayment: loan.total_repayment
      });

      // Garantir que os valores sejam números válidos
      const validPrincipal = isNaN(calculatedPrincipal) ? 0 : calculatedPrincipal;
      const validInterest = isNaN(calculatedInterest) ? 0 : calculatedInterest;

      console.log('DEBUG - Valores finais após validação:', {
        validPrincipal,
        validInterest,
        interestForProfit: validInterest * 0.85,
        interestForOperational: validInterest * 0.15
      });

      return {
        success: true,
        principalAmount: validPrincipal,
        interestAmount: validInterest
      } as PaymentApprovalResult;
    });

    // Se houve sucesso na aprovação e geração de juros PARA LUCRO
    // REMOVIDO: Distribuição automática imediata.
    // O lucro acumula no pool e será distribuído pelo Cron Job.

    // Casting do resultado da transação
    const finalResult = result as PaymentApprovalResult;

    const principalReturned = finalResult.principalAmount || 0;
    const interestAdded = finalResult.interestAmount || 0;
    const interestForProfit = interestAdded ? interestAdded * 0.85 : 0;
    const interestForOperational = interestAdded ? interestAdded * 0.15 : 0;

    console.log('DEBUG - Valores finais para retorno ao frontend:', {
      transactionId,
      principalReturned,
      interestAdded,
      interestForProfit,
      interestForOperational,
      rawResult: finalResult
    });

    return c.json({
      success: true,
      message: 'Pagamento aprovado com sucesso! Principal devolvido ao caixa, juros distribuídos (85% para lucro, 15% para caixa).',
      data: {
        transactionId,
        principalReturned,
        interestAdded,
        interestForProfit,
        interestForOperational
      }
    });
  } catch (error) {
    console.error('Erro ao aprovar pagamento:', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, 500);
  }
});

// Rejeitar pagamentos de empréstimos pendentes
adminRoutes.post('/reject-payment', adminMiddleware, auditMiddleware('REJECT_PAYMENT', 'TRANSACTION'), async (c) => {
  try {
    const body = await c.req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return c.json({ success: false, message: 'transactionId é obrigatório' }, 400);
    }

    const pool = getDbPool(c);

    // Executar dentro de transação para garantir consistência
    const result = await executeInTransaction(pool, async (client) => {
      // Buscar transação de pagamento com bloqueio
      const transactionResult = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
        [transactionId, 'PENDING']
      );

      if (transactionResult.rows.length === 0) {
        throw new Error('Transação não encontrada ou já processada');
      }

      const transaction = transactionResult.rows[0];

      // Verificar se é uma transação de pagamento de empréstimo
      if (transaction.type !== 'LOAN_PAYMENT') {
        throw new Error('Transação não é um pagamento de empréstimo');
      }

      // Verificar se metadata já é um objeto ou precisa fazer parse
      let metadata: any = {};
      try {
        // Verificar se metadata já é um objeto
        if (transaction.metadata && typeof transaction.metadata === 'object') {
          metadata = transaction.metadata;
          console.log('DEBUG - Metadata já é objeto (rejeição):', metadata);
        } else {
          // Se for string, fazer parse
          const metadataStr = String(transaction.metadata || '{}').trim();
          console.log('DEBUG - Metadata da transação (string) (rejeição):', metadataStr);
          if (metadataStr.startsWith('{') || metadataStr.startsWith('[')) {
            metadata = JSON.parse(metadataStr);
            console.log('DEBUG - Metadata parseado (rejeição):', metadata);
          }
        }
      } catch (error) {
        console.error('Erro ao fazer parse do metadata (rejeição):', error);
        metadata = {};
      }

      if (!metadata.loanId) {
        throw new Error('Metadata não contém loanId');
      }

      // Reembolsar o cliente se o pagamento foi feito com saldo
      if (metadata.useBalance) {
        await updateUserBalance(client, transaction.user_id, parseFloat(transaction.amount), 'credit');
        console.log('DEBUG - Saldo reembolsado:', parseFloat(transaction.amount));
      }

      // Reativar o empréstimo para permitir novo pagamento
      await client.query(
        'UPDATE loans SET status = $1 WHERE id = $2',
        ['APPROVED', metadata.loanId]
      );

      console.log('DEBUG - Empréstimo reativado:', metadata.loanId);

      // Atualizar status da transação para REJEITADO
      const updateResult = await updateTransactionStatus(
        client,
        transactionId,
        'PENDING',
        'REJECTED'
      );

      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      return {
        success: true,
        loanId: metadata.loanId,
        amountRefunded: metadata.useBalance ? parseFloat(transaction.amount) : 0
      };
    });

    return c.json({
      success: true,
      message: 'Pagamento rejeitado! Empréstimo reativado para novo pagamento.',
      data: {
        transactionId,
        loanId: (result as any).loanId,
        amountRefunded: (result as any).amountRefunded
      }
    });
  } catch (error) {
    console.error('Erro ao rejeitar pagamento:', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, 500);
  }
});

// Aprovar saques pendentes
adminRoutes.post('/approve-withdrawal', adminMiddleware, auditMiddleware('APPROVE_WITHDRAWAL', 'TRANSACTION'), async (c) => {
  try {
    const body = await c.req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return c.json({ success: false, message: 'transactionId é obrigatório' }, 400);
    }

    const pool = getDbPool(c);

    // Executar dentro de transação para garantir consistência
    const result = await executeInTransaction(pool, async (client) => {
      // Buscar transação de saque com bloqueio
      const transactionResult = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
        [transactionId, 'PENDING']
      );

      if (transactionResult.rows.length === 0) {
        throw new Error('Transação não encontrada ou já processada');
      }

      const transaction = transactionResult.rows[0];

      // Verificar se é uma transação de saque
      if (transaction.type !== 'WITHDRAWAL') {
        throw new Error('Transação não é um saque');
      }

      // Verificar se metadata já é um objeto ou precisa fazer parse
      let metadata: any = {};
      try {
        // Verificar se metadata já é um objeto
        if (transaction.metadata && typeof transaction.metadata === 'object') {
          metadata = transaction.metadata;
          console.log('DEBUG - Metadata já é objeto (saque):', metadata);
        } else {
          // Se for string, fazer parse
          const metadataStr = String(transaction.metadata || '{}').trim();
          console.log('DEBUG - Metadata da transação (saque) (string):', metadataStr);
          if (metadataStr.startsWith('{') || metadataStr.startsWith('[')) {
            metadata = JSON.parse(metadataStr);
            console.log('DEBUG - Metadata parseado (saque):', metadata);
          }
        }
      } catch (error) {
        console.error('Erro ao fazer parse do metadata (saque):', error);
        metadata = {};
      }

      const withdrawalAmount = parseFloat(transaction.amount);

      // Validações para evitar valores negativos ou cálculos incorretos
      if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        throw new Error('Valor do saque inválido ou negativo');
      }

      // Calcular taxa de saque (2% ou R$ 5,00, o que for maior)
      const feePercentage = 0.02;
      const feeFixed = 5.00;
      const feeAmount = Math.max(withdrawalAmount * feePercentage, feeFixed);
      const netAmount = withdrawalAmount - feeAmount;

      // Validações adicionais para integridade dos valores
      if (feeAmount >= withdrawalAmount) {
        throw new Error('Taxa não pode ser maior ou igual ao valor do saque');
      }

      if (netAmount < 0) {
        throw new Error('Valor líquido do saque não pode ser negativo');
      }

      // Validar limites máximos e mínimos
      if (withdrawalAmount > 10000) {
        throw new Error('Valor máximo de saque é R$ 10.000,00');
      }

      if (netAmount < 1) {
        throw new Error('Valor líquido mínimo após taxa é R$ 1,00');
      }

      console.log('DEBUG - Aprovação de saque:', {
        transactionId,
        withdrawalAmount,
        feeAmount,
        netAmount,
        feePercentage,
        feeFixed
      });

      // Deduzir valor líquido do caixa operacional
      await client.query(
        'UPDATE system_config SET system_balance = system_balance - $1',
        [netAmount]
      );

      // Aplicar nova regra: 85% da taxa para o caixa operacional e 15% para o lucro de juros
      const feeForOperational = feeAmount * 0.85; // 85% da taxa vai para o caixa operacional
      const feeForProfit = feeAmount * 0.15; // 15% da taxa vai para o lucro de juros

      // Adicionar 85% da taxa ao caixa operacional
      await client.query(
        'UPDATE system_config SET system_balance = system_balance + $1',
        [feeForOperational]
      );

      // Adicionar 15% da taxa ao lucro de juros
      await client.query(
        'UPDATE system_config SET profit_pool = profit_pool + $1',
        [feeForProfit]
      );

      console.log('DEBUG - Distribuição de taxa de saque (nova regra 85/15):', {
        transactionId,
        withdrawalAmount,
        feeAmount,
        feeForOperational,
        feeForProfit,
        netAmount,
        totalWithdrawal: withdrawalAmount,
        timestamp: new Date().toISOString(),
        adminId: c.get('user')?.id,
        adminEmail: c.get('user')?.email
      });

      // Log de auditoria para distribuição de taxa de saque
      // Usando admin_logs que é a tabela correta e ajustando colunas
      await client.query(
        `INSERT INTO admin_logs (action, entity_id, entity_type, new_values, admin_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'WITHDRAWAL_FEE_DISTRIBUTION',
          transactionId,
          'WITHDRAWAL',
          JSON.stringify({
            withdrawalAmount,
            feeAmount,
            feeForOperational,
            feeForProfit,
            netAmount,
            distributionRule: '85% operational, 15% profit'
          }),
          c.get('user')?.id,
          new Date()
        ]
      );

      // Atualizar status da transação para APROVADO
      const updateResult = await updateTransactionStatus(
        client,
        transactionId,
        'PENDING',
        'APPROVED'
      );

      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      console.log('DEBUG - Saque aprovado e processado:', {
        transactionId,
        netAmountDeducted: netAmount,
        feeAddedToProfit: feeAmount,
        totalWithdrawal: withdrawalAmount
      });

      return {
        success: true,
        netAmount,
        feeAmount,
        totalAmount: withdrawalAmount
      };
    });

    const finalResult = result as any;

    return c.json({
      success: true,
      message: 'Saque aprovado com sucesso! Valor líquido deduzido do caixa operacional e taxa distribuída (85% para caixa, 15% para lucro de juros).',
      data: {
        transactionId,
        netAmount: finalResult.netAmount,
        feeAmount: finalResult.feeAmount,
        feeForOperational: finalResult.feeAmount * 0.85,
        feeForProfit: finalResult.feeAmount * 0.15,
        totalAmount: finalResult.totalAmount
      }
    });
  } catch (error) {
    console.error('Erro ao aprovar saque:', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, 500);
  }
});

// Rejeitar saques pendentes
adminRoutes.post('/reject-withdrawal', adminMiddleware, auditMiddleware('REJECT_WITHDRAWAL', 'TRANSACTION'), async (c) => {
  try {
    const body = await c.req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return c.json({ success: false, message: 'transactionId é obrigatório' }, 400);
    }

    const pool = getDbPool(c);

    // Executar dentro de transação para garantir consistência
    const result = await executeInTransaction(pool, async (client) => {
      // Buscar transação de saque com bloqueio
      const transactionResult = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
        [transactionId, 'PENDING']
      );

      if (transactionResult.rows.length === 0) {
        throw new Error('Transação não encontrada ou já processada');
      }

      const transaction = transactionResult.rows[0];

      // Verificar se é uma transação de saque
      if (transaction.type !== 'WITHDRAWAL') {
        throw new Error('Transação não é um saque');
      }

      // Reembolsar o cliente (devolver o valor ao saldo do cliente)
      await updateUserBalance(client, transaction.user_id, parseFloat(transaction.amount), 'credit');

      console.log('DEBUG - Saldo reembolsado (rejeição de saque):', parseFloat(transaction.amount));

      // Atualizar status da transação para REJEITADO
      const updateResult = await updateTransactionStatus(
        client,
        transactionId,
        'PENDING',
        'REJECTED'
      );

      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      return {
        success: true,
        amountRefunded: parseFloat(transaction.amount)
      };
    });

    return c.json({
      success: true,
      message: 'Saque rejeitado! Valor reembolsado na conta do cliente.',
      data: {
        transactionId,
        amountRefunded: (result as any).amountRefunded
      }
    });
  } catch (error) {
    console.error('Erro ao rejeitar saque:', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, 500);
  }
});

// Rota temporária para limpar administradores
adminRoutes.post('/clear-admins', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);

    // Limpar todos os administradores existentes
    await pool.query('UPDATE users SET is_admin = FALSE WHERE is_admin = TRUE');

    return c.json({
      success: true,
      message: 'Todos os administradores foram removidos. O próximo usuário a se registrar será o administrador.'
    });
  } catch (error) {
    console.error('Erro ao limpar administradores:', error);
    return c.json({
      success: false,
      message: 'Erro ao limpar administradores'
    }, 500);
  }
});



// Simular aprovação de pagamento via Mercado Pago (Apenas Sandbox)
adminRoutes.post('/simulate-mp-payment', adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { paymentId, transactionId } = simulateMpSchema.parse(body);

    console.log(`[ADMIN] Simulando aprovação MP para Pagamento ${paymentId}, Transação ${transactionId}`);

    // 1. Tentar aprovar no Mercado Pago de verdade (só funciona em Sandbox)
    try {
      await simulatePaymentApproval(paymentId);
      console.log(`[ADMIN] Status atualizado no Mercado Pago para 'approved'`);
    } catch (mpError: any) {
      console.warn(`[ADMIN] Aviso: Não foi possível atualizar no Mercado Pago: ${mpError.message}`);
    }

    // 2. Forçar aprovação interna (mesma lógica do Webhook)
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
});

// Adicionar custo manual ao sistema
adminRoutes.post('/manual-cost', adminMiddleware, auditMiddleware('ADD_MANUAL_COST', 'SYSTEM_CONFIG'), async (c) => {
  try {
    const body = await c.req.json();
    const amount = parseFloat(body.amount);

    if (isNaN(amount) || amount <= 0) {
      return c.json({ success: false, message: 'Valor inválido' }, 400);
    }

    const pool = getDbPool(c);

    await executeInTransaction(pool, async (client) => {
      // 1. Deduzir do caixa operacional e adicionar aos custos manuais
      await client.query(
        'UPDATE system_config SET system_balance = system_balance - $1, total_manual_costs = total_manual_costs + $1',
        [amount]
      );

      // 2. Registrar no log de auditoria
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
  } catch (error) {
    console.error('Erro ao adicionar custo manual:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Liquidar empréstimo usando as cotas do usuário como garantia (Exercer Garantia)
adminRoutes.post('/liquidate-loan', adminMiddleware, auditMiddleware('LIQUIDATE_LOAN_WITH_QUOTAS', 'LOAN'), async (c) => {
  try {
    const body = await c.req.json();
    const { loanId } = body;

    if (!loanId) {
      return c.json({ success: false, message: 'ID do empréstimo é obrigatório' }, 400);
    }

    const pool = getDbPool(c);

    const result = await executeInTransaction(pool, async (client) => {
      // 1. Buscar empréstimo
      const loanRes = await client.query('SELECT * FROM loans WHERE id = $1 FOR UPDATE', [loanId]);
      if (loanRes.rows.length === 0) throw new Error('Empréstimo não encontrado');
      const loan = loanRes.rows[0];

      if (loan.status === 'PAID') throw new Error('Empréstimo já está quitado');

      // 2. Calcular quanto o usuário deve (Total - já pago)
      const paidRes = await client.query('SELECT COALESCE(SUM(amount), 0) as total FROM loan_installments WHERE loan_id = $1', [loanId]);
      const debtAmount = parseFloat(loan.total_repayment) - parseFloat(paidRes.rows[0].total);

      // 3. Buscar cotas ativas do usuário para liquidar
      const quotasRes = await client.query('SELECT id, current_value FROM quotas WHERE user_id = $1 AND status = $2 FOR UPDATE', [loan.user_id, 'ACTIVE']);
      const userQuotas = quotasRes.rows;

      let liquidatedValue = 0;
      const quotasToLiquidate = [];

      for (const q of userQuotas) {
        if (liquidatedValue < debtAmount) {
          liquidatedValue += parseFloat(q.current_value);
          quotasToLiquidate.push(q.id);
        }
      }

      if (liquidatedValue === 0) throw new Error('Usuário não possui cotas ativas para garantir a dívida');

      // 4. Executar a liquidação
      // Deletar as cotas (elas voltam para o sistema como caixa)
      if (quotasToLiquidate.length > 0) {
        await client.query('DELETE FROM quotas WHERE id = ANY($1)', [quotasToLiquidate]);
      }

      // Devolver o principal ao caixa do sistema
      await client.query('UPDATE system_config SET system_balance = system_balance + $1', [liquidatedValue]);

      // Marcar empréstimo como PAGO (Integral ou parcial dependendo do valor)
      const newStatus = liquidatedValue >= debtAmount ? 'PAID' : loan.status;
      await client.query('UPDATE loans SET status = $1 WHERE id = $2', [newStatus, loanId]);

      // Registrar transação de liquidação forçada
      const admin = c.get('user');
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, description, status, metadata)
         VALUES ($1, 'SYSTEM_LIQUIDATION', $2, $3, 'APPROVED', $4)`,
        [
          loan.user_id,
          liquidatedValue,
          `Liquidação forçada de ${quotasToLiquidate.length} cota(s) para quitar empréstimo ${loanId}`,
          JSON.stringify({ adminId: admin.id, loanId, quotasCount: quotasToLiquidate.length })
        ]
      );

      return { success: true, liquidatedValue, isFullyPaid: newStatus === 'PAID' };
    });

    return c.json(result);
  } catch (error: any) {
    console.error('Erro ao liquidar empréstimo:', error);
    return c.json({ success: false, message: error.message || 'Erro interno' }, 500);
  }
});

// --- GESTÃO DE CÓDIGOS DE INDICAÇÃO (REFERRAL CODES) ---

// Listar todos os códigos
adminRoutes.get('/referral-codes', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);
    const result = await pool.query(`
      SELECT rc.*, u.name as creator_name 
      FROM referral_codes rc
      LEFT JOIN users u ON rc.created_by = u.id
      ORDER BY rc.created_at DESC
    `);
    return c.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao listar códigos de indicação:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Criar novo código
adminRoutes.post('/referral-codes', adminMiddleware, auditMiddleware('CREATE_REFERRAL_CODE', 'REFERRAL_CODE'), async (c) => {
  try {
    const body = await c.req.json();
    const { code, maxUses } = createReferralCodeSchema.parse(body);
    const user = c.get('user');
    const pool = getDbPool(c);

    const result = await pool.query(
      'INSERT INTO referral_codes (code, created_by, max_uses) VALUES ($1, $2, $3) RETURNING *',
      [code, user.id, maxUses]
    );

    return c.json({
      success: true,
      message: 'Código de indicação criado com sucesso!',
      data: result.rows[0]
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ success: false, message: 'Este código já existe. Escolha outro.' }, 409);
    }
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }
    console.error('Erro ao criar código de indicação:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Ativar/Desativar código
adminRoutes.post('/referral-codes/:id/toggle', adminMiddleware, auditMiddleware('TOGGLE_REFERRAL_CODE', 'REFERRAL_CODE'), async (c) => {
  try {
    const id = c.req.param('id');
    const pool = getDbPool(c);

    const result = await pool.query(
      'UPDATE referral_codes SET is_active = NOT is_active WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Código não encontrado' }, 404);
    }

    return c.json({
      success: true,
      message: `Código ${result.rows[0].is_active ? 'ativado' : 'desativado'} com sucesso!`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao toggle código de indicação:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

adminRoutes.delete('/referral-codes/:id', adminMiddleware, auditMiddleware('DELETE_REFERRAL_CODE', 'REFERRAL_CODE'), async (c) => {
  try {
    const id = c.req.param('id');
    const pool = getDbPool(c);
    const result = await pool.query('DELETE FROM referral_codes WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Código não encontrado' }, 404);
    }

    return c.json({ success: true, message: 'Código removido com sucesso!' });
  } catch (error) {
    console.error('Erro ao remover código de indicação:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Resolver Disputa de Marketplace
const resolveDisputeSchema = z.object({
  orderId: z.number(),
  resolution: z.enum(['REFUND_BUYER', 'RELEASE_TO_SELLER']),
  penaltyUserId: z.number().optional(), // Usuário que agiu de má fé para perder score
});

adminRoutes.post('/marketplace/resolve-dispute', adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { orderId, resolution, penaltyUserId } = resolveDisputeSchema.parse(body);
    const pool = getDbPool(c);

    // 1. Buscar o pedido em disputa
    const orderRes = await pool.query('SELECT * FROM marketplace_orders WHERE id = $1 AND status = \'DISPUTE\'', [orderId]);
    if (orderRes.rows.length === 0) return c.json({ success: false, message: 'Disputa não encontrada.' }, 404);
    const order = orderRes.rows[0];

    const result = await executeInTransaction(pool, async (client) => {
      if (resolution === 'REFUND_BUYER') {
        // Estornar Comprador (Igual ao cancelamento)
        await client.query('UPDATE marketplace_orders SET status = \'CANCELLED\', updated_at = NOW() WHERE id = $1', [orderId]);
        await client.query('UPDATE marketplace_listings SET status = \'ACTIVE\' WHERE id = $1', [order.listing_id]);

        if (order.payment_method === 'BALANCE') {
          await updateUserBalance(client, order.buyer_id, parseFloat(order.amount), 'credit');
          await createTransaction(client, order.buyer_id, 'MARKET_REFUND', parseFloat(order.amount), `Disputa Resolvida: Estorno do Pedido #${orderId}`, 'APPROVED');
        } else if (order.payment_method === 'CRED30_CREDIT') {
          await client.query("UPDATE loans SET status = 'CANCELLED' WHERE status = 'APPROVED' AND metadata->>'orderId' = $1", [orderId.toString()]);
        }
      } else {
        // Liberar para o Vendedor (Igual à finalização)
        await client.query('UPDATE marketplace_orders SET status = \'COMPLETED\', updated_at = NOW() WHERE id = $1', [orderId]);

        const sellerAmount = parseFloat(order.seller_amount);
        if (order.payment_method === 'CRED30_CREDIT') {
          await client.query('UPDATE system_config SET system_balance = system_balance - $1', [order.amount]);
        }
        await updateUserBalance(client, order.seller_id, sellerAmount, 'credit');

        // Taxas
        const feeAmount = parseFloat(order.fee_amount);
        await client.query('UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2', [feeAmount * 0.85, feeAmount * 0.15]);

        await createTransaction(client, order.seller_id, 'MARKET_SALE', sellerAmount, `Disputa Resolvida: Venda #${orderId} Liberada`, 'APPROVED', { orderId });
      }

      // Aplicar Penalidade se houver culpado claro
      if (penaltyUserId) {
        await updateScore(client, penaltyUserId, -100, `Penalidade: Má fé em disputa de marketplace (#${orderId})`);
      }

      return { success: true };
    });

    return c.json({ success: true, message: `Disputa resolvida: ${resolution}` });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Forçar Liquidação Automática
adminRoutes.post('/run-liquidation', adminMiddleware, auditMiddleware('FORCE_LIQUIDATION', 'LOAN'), async (c) => {
  try {
    const pool = getDbPool(c);
    const result = await runAutoLiquidation(pool);
    return c.json({
      success: true,
      message: `Varredura concluída. ${result.liquidatedCount} garantias executadas.`,
      data: result
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Registrar Custo Manual (Despesa)
adminRoutes.post('/manual-cost', adminMiddleware, auditMiddleware('RECORD_MANUAL_COST', 'SYSTEM_CONFIG'), async (c) => {
  try {
    const body = await c.req.json();
    const { amount, description } = z.object({ amount: z.number().positive(), description: z.string() }).parse(body);
    const pool = getDbPool(c);

    await pool.query(
      'UPDATE system_config SET system_balance = system_balance - $1, total_manual_costs = total_manual_costs + $1',
      [amount]
    );

    return c.json({ success: true, message: 'Custo registrado e deduzido do caixa.' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// --- GESTÃO DE USUÁRIOS E EQUIPE (MODO FINTECH) ---

const updateUserRoleStatusSchema = z.object({
  userId: z.number(),
  role: z.enum(['MEMBER', 'ATTENDANT', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'BLOCKED']).optional()
});

const createAttendantSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  secretPhrase: z.string().min(3),
  pixKey: z.string().min(5)
});

// Listar todos os usuários com filtros e paginação
adminRoutes.get('/users', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);
    const { search, role, status, limit, offset } = c.req.query();
    const limitNum = parseInt(limit || '50');
    const offsetNum = parseInt(offset || '0');

    let baseQuery = `
      FROM users
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      baseQuery += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      baseQuery += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (status) {
      baseQuery += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Buscar total para paginação
    const totalResult = await pool.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
    const total = parseInt(totalResult.rows[0].total);

    // Buscar dados paginados
    const dataQuery = `
      SELECT id, name, email, role, status, balance, score, created_at, pix_key, membership_type
      ${baseQuery}
      ORDER BY created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limitNum, offsetNum);

    const result = await pool.query(dataQuery, params);
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
    console.error('Erro ao listar usuários:', error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Atualizar Role ou Status de um usuário
adminRoutes.post('/users/update-access', adminMiddleware, auditMiddleware('UPDATE_USER_ACCESS', 'USER'), async (c) => {
  try {
    const body = await c.req.json();
    const { userId, role, status } = updateUserRoleStatusSchema.parse(body);
    const pool = getDbPool(c);

    const updateFields = [];
    const params = [];
    let index = 1;

    if (role) {
      updateFields.push(`role = $${index++}`);
      params.push(role);
    }
    if (status) {
      updateFields.push(`status = $${index++}`);
      params.push(status);
    }

    if (updateFields.length === 0) {
      return c.json({ success: false, message: 'Nenhuma alteração fornecida' }, 400);
    }

    params.push(userId);
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${index} RETURNING id`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    return c.json({ success: true, message: 'Permissões atualizadas com sucesso' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Criar um novo atendente diretamente
adminRoutes.post('/users/create-attendant', adminMiddleware, auditMiddleware('CREATE_ATTENDANT', 'USER'), async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, password, secretPhrase, pixKey } = createAttendantSchema.parse(body);
    const pool = getDbPool(c);
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, role, status)
       VALUES ($1, $2, $3, $4, $5, 'ATTENDANT', 'ACTIVE') RETURNING id`,
      [name, email, passwordHash, secretPhrase, pixKey]
    );

    return c.json({ success: true, message: 'Atendente criado com sucesso', data: { id: result.rows[0].id } });
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ success: false, message: 'Email já cadastrado' }, 409);
    }
    return c.json({ success: false, message: error.message }, 500);
  }
});

// --- GERENCIAMENTO DE AVALIAÇÕES/DEPOIMENTOS ---

// Listar todas as avaliações (admin pode ver todas)
adminRoutes.get('/reviews', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);

    const result = await pool.query(`
      SELECT 
        r.id,
        r.transaction_id,
        r.rating,
        r.comment,
        r.is_public,
        r.is_approved,
        r.created_at,
        u.name as user_name,
        u.email as user_email,
        t.amount as transaction_amount
      FROM transaction_reviews r
      JOIN users u ON r.user_id = u.id
      JOIN transactions t ON r.transaction_id = t.id
      ORDER BY r.created_at DESC
    `);

    return c.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        transaction_amount: parseFloat(row.transaction_amount)
      }))
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Aprovar avaliação como depoimento público
adminRoutes.post('/reviews/:id/approve', adminMiddleware, async (c) => {
  try {
    const reviewId = c.req.param('id');
    const pool = getDbPool(c);

    await pool.query(
      'UPDATE transaction_reviews SET is_approved = TRUE WHERE id = $1',
      [reviewId]
    );

    return c.json({ success: true, message: 'Avaliação aprovada como depoimento!' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Rejeitar/desaprovar avaliação
adminRoutes.post('/reviews/:id/reject', adminMiddleware, async (c) => {
  try {
    const reviewId = c.req.param('id');
    const pool = getDbPool(c);

    await pool.query(
      'UPDATE transaction_reviews SET is_approved = FALSE, is_public = FALSE WHERE id = $1',
      [reviewId]
    );

    return c.json({ success: true, message: 'Avaliação rejeitada.' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// =====================================================
// GESTÃO DE INVESTIMENTOS (Fundo de Patrimônio Sólido)
// =====================================================

const investmentSchema = z.object({
  assetName: z.string().min(2).max(100),
  assetType: z.enum(['STOCK', 'FII', 'BOND', 'ETF', 'OTHER']),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().positive(),
  totalInvested: z.number().positive(),
  broker: z.string().optional(),
  notes: z.string().optional(),
  investedAt: z.string().optional() // ISO date string
});

// Listar todos os investimentos
adminRoutes.get('/investments', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);

    const activeResult = await pool.query(`
      SELECT * FROM investments WHERE status = 'ACTIVE' ORDER BY invested_at DESC
    `);

    const soldResult = await pool.query(`
      SELECT * FROM investments WHERE status = 'SOLD' ORDER BY sold_at DESC
    `);

    // Buscar saldo disponível para investir
    const reserveResult = await pool.query(`
      SELECT COALESCE(investment_reserve, 0) as reserve FROM system_config LIMIT 1
    `);

    const availableReserve = parseFloat(reserveResult.rows[0]?.reserve || 0);
    const totalInvested = activeResult.rows.reduce((acc: any, inv: any) => acc + parseFloat(inv.total_invested), 0);
    const totalCurrentValue = activeResult.rows.reduce((acc: any, inv: any) => acc + parseFloat(inv.current_value || inv.total_invested), 0);

    // Total de dividendos (ativos e vendidos)
    const activeDividends = activeResult.rows.reduce((acc: any, inv: any) => acc + parseFloat(inv.dividends_received || 0), 0);
    const soldDividends = soldResult.rows.reduce((acc: any, inv: any) => acc + parseFloat(inv.dividends_received || 0), 0);
    const totalDividends = activeDividends + soldDividends;

    return c.json({
      success: true,
      data: {
        investments: activeResult.rows.map(inv => ({
          id: inv.id,
          assetName: inv.asset_name,
          assetType: inv.asset_type,
          quantity: parseFloat(inv.quantity) || 0,
          unitPrice: parseFloat(inv.unit_price),
          totalInvested: parseFloat(inv.total_invested),
          currentValue: parseFloat(inv.current_value || inv.total_invested),
          dividendsReceived: parseFloat(inv.dividends_received || 0),
          broker: inv.broker,
          notes: inv.notes,
          investedAt: inv.invested_at,
          status: inv.status,
          profitLoss: parseFloat(inv.current_value || inv.total_invested) - parseFloat(inv.total_invested),
          profitLossPercent: ((parseFloat(inv.current_value || inv.total_invested) / parseFloat(inv.total_invested)) - 1) * 100
        })),
        sold: soldResult.rows.map(inv => ({
          id: inv.id,
          assetName: inv.asset_name,
          assetType: inv.asset_type,
          quantity: parseFloat(inv.quantity) || 0,
          unitPrice: parseFloat(inv.unit_price),
          totalInvested: parseFloat(inv.total_invested),
          saleValue: parseFloat(inv.sale_value),
          soldAt: inv.sold_at,
          dividendsReceived: parseFloat(inv.dividends_received || 0),
          broker: inv.broker,
          status: inv.status,
          profitLoss: parseFloat(inv.sale_value) - parseFloat(inv.total_invested),
          profitLossPercent: ((parseFloat(inv.sale_value) / parseFloat(inv.total_invested)) - 1) * 100
        })),
        summary: {
          availableReserve,
          totalInvested,
          totalCurrentValue,
          totalDividends,
          totalProfitLoss: totalCurrentValue - totalInvested,
          totalProfitLossPercent: totalInvested > 0 ? ((totalCurrentValue / totalInvested) - 1) * 100 : 0
        }
      }
    });
  } catch (error: any) {
    console.error('[INVESTMENTS] Erro ao listar:', error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Registrar novo investimento
adminRoutes.post('/investments', adminMiddleware, auditMiddleware('CREATE_INVESTMENT', 'INVESTMENT'), async (c) => {
  try {
    const body = await c.req.json();
    const data = investmentSchema.parse(body);
    const pool = getDbPool(c);

    const result = await executeInTransaction(pool, async (client) => {
      // Verificar se há saldo suficiente na reserva
      const reserveResult = await client.query(
        'SELECT COALESCE(investment_reserve, 0) as reserve FROM system_config LIMIT 1 FOR UPDATE'
      );
      const availableReserve = parseFloat(reserveResult.rows[0]?.reserve || 0);

      if (data.totalInvested > availableReserve) {
        throw new Error(`Saldo insuficiente na reserva de investimentos. Disponível: R$ ${availableReserve.toFixed(2)}`);
      }

      // Deduzir do investment_reserve
      await client.query(
        'UPDATE system_config SET investment_reserve = investment_reserve - $1',
        [data.totalInvested]
      );

      // Inserir investimento
      const invResult = await client.query(`
        INSERT INTO investments (asset_name, asset_type, quantity, unit_price, total_invested, current_value, broker, notes, invested_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        data.assetName,
        data.assetType,
        data.quantity || 0,
        data.unitPrice,
        data.totalInvested,
        data.totalInvested, // currentValue starts equal to invested
        data.broker || null,
        data.notes || null,
        data.investedAt ? new Date(data.investedAt) : new Date()
      ]);

      return { investmentId: invResult.rows[0].id };
    });

    if (!result.success) {
      return c.json({ success: false, message: result.error }, 400);
    }

    return c.json({
      success: true,
      message: `Investimento em ${data.assetName} registrado com sucesso!`,
      data: { id: result.data?.investmentId }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }
    console.error('[INVESTMENTS] Erro ao criar:', error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Atualizar valor atual do investimento
adminRoutes.patch('/investments/:id', adminMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { currentValue, dividendsReceived } = body;
    const pool = getDbPool(c);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (currentValue !== undefined) {
      updates.push(`current_value = $${paramIndex++}`);
      values.push(currentValue);
    }

    if (dividendsReceived !== undefined) {
      updates.push(`dividends_received = $${paramIndex++}`);
      values.push(dividendsReceived);
    }

    if (updates.length === 0) {
      return c.json({ success: false, message: 'Nenhum campo para atualizar' }, 400);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE investments SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    return c.json({ success: true, message: 'Investimento atualizado!' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Registrar dividendos recebidos (adiciona ao saldo do sistema)
adminRoutes.post('/investments/:id/dividends', adminMiddleware, auditMiddleware('RECEIVE_DIVIDEND', 'INVESTMENT'), async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { amount, reinvest } = body;

    if (!amount || amount <= 0) {
      return c.json({ success: false, message: 'Valor do dividendo inválido' }, 400);
    }

    const pool = getDbPool(c);

    await executeInTransaction(pool, async (client) => {
      // Atualizar dividendos recebidos no investimento
      await client.query(
        'UPDATE investments SET dividends_received = dividends_received + $1, updated_at = NOW() WHERE id = $2',
        [amount, id]
      );

      if (reinvest) {
        // Reinvestir: adiciona de volta ao investment_reserve
        await client.query(
          'UPDATE system_config SET investment_reserve = COALESCE(investment_reserve, 0) + $1',
          [amount]
        );
      } else {
        // Depositar no caixa do sistema (vira receita operacional)
        await client.query(
          'UPDATE system_config SET system_balance = system_balance + $1, profit_pool = profit_pool + $2',
          [amount, amount * 0.5] // 50% vai pro profit_pool para distribuir aos membros
        );
      }
    });

    return c.json({
      success: true,
      message: reinvest
        ? `Dividendos de R$ ${amount.toFixed(2)} reinvestidos!`
        : `Dividendos de R$ ${amount.toFixed(2)} creditados no sistema!`
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Liquidar investimento (vender)
adminRoutes.post('/investments/:id/sell', adminMiddleware, auditMiddleware('SELL_INVESTMENT', 'INVESTMENT'), async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { saleValue } = body;

    if (!saleValue || saleValue <= 0) {
      return c.json({ success: false, message: 'Valor de venda inválido' }, 400);
    }

    const pool = getDbPool(c);

    const result = await executeInTransaction(pool, async (client) => {
      // Buscar investimento
      const invResult = await client.query('SELECT * FROM investments WHERE id = $1 FOR UPDATE', [id]);
      if (invResult.rows.length === 0) {
        throw new Error('Investimento não encontrado');
      }

      const investment = invResult.rows[0];
      const totalInvested = parseFloat(investment.total_invested);
      const profitLoss = saleValue - totalInvested;

      // Creditar valor de volta ao investment_reserve
      await client.query(
        'UPDATE system_config SET investment_reserve = COALESCE(investment_reserve, 0) + $1',
        [saleValue]
      );

      // Marcar como vendido
      await client.query(
        'UPDATE investments SET status = $1, sale_value = $2, sold_at = NOW(), updated_at = NOW() WHERE id = $3',
        ['SOLD', saleValue, id]
      );

      return { assetName: investment.asset_name, profitLoss };
    });

    if (!result.success) {
      return c.json({ success: false, message: result.error }, 400);
    }

    const msg = result.data!.profitLoss >= 0
      ? `${result.data!.assetName} vendido com lucro de R$ ${result.data!.profitLoss.toFixed(2)}!`
      : `${result.data!.assetName} vendido com prejuízo de R$ ${Math.abs(result.data!.profitLoss).toFixed(2)}.`;

    return c.json({ success: true, message: msg });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Aporte manual na reserva de investimentos (Dinheiro vindo de fora)
adminRoutes.post('/investments/reserve/add', adminMiddleware, auditMiddleware('MANUAL_INVESTMENT_DEPOSIT', 'INVESTMENT'), async (c) => {
  try {
    const body = await c.req.json();
    const { amount, description } = body;
    const user = c.get('user');

    if (!amount || amount <= 0) {
      return c.json({ success: false, message: 'Valor inválido para aporte' }, 400);
    }

    const pool = getDbPool(c);

    // Atualizar a reserva
    await pool.query(
      'UPDATE system_config SET investment_reserve = COALESCE(investment_reserve, 0) + $1, updated_at = NOW()',
      [amount]
    );

    // Registrar no histórico de movimentações (admin_logs já captura via auditMiddleware)
    // Também registrar em uma transaction para melhor rastreabilidade
    await pool.query(`
      INSERT INTO transactions (user_id, type, amount, description, status, metadata, created_at)
      VALUES ($1, 'INVESTMENT_DEPOSIT', $2, $3, 'COMPLETED', $4, NOW())
    `, [
      user.id,
      amount,
      description || 'Aporte externo na reserva de investimentos',
      JSON.stringify({ source: 'MANUAL_RESERVE_DEPOSIT', adminId: user.id, adminName: user.name })
    ]);

    return c.json({
      success: true,
      message: `Aporte de R$ ${amount.toFixed(2)} registrado com sucesso na reserva!`
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Histórico de movimentações da reserva de investimentos
adminRoutes.get('/investments/reserve/history', adminMiddleware, async (c) => {
  try {
    const pool = getDbPool(c);

    // Buscar transações de tipo INVESTMENT_DEPOSIT e vendas de investimentos
    const result = await pool.query(`
      SELECT 
        t.id,
        t.type,
        t.amount,
        t.description,
        t.metadata,
        t.created_at,
        u.name as admin_name
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.type IN ('INVESTMENT_DEPOSIT', 'INVESTMENT_SALE', 'INVESTMENT_DIVIDEND')
      ORDER BY t.created_at DESC
      LIMIT 50
    `);

    return c.json({
      success: true,
      data: result.rows.map(r => ({
        id: r.id,
        type: r.type,
        amount: parseFloat(r.amount),
        description: r.description,
        metadata: r.metadata,
        adminName: r.admin_name,
        createdAt: r.created_at
      }))
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// =====================================================
// LIMPEZA DE ANÚNCIOS ANTIGOS SEM IMPULSO (ECONOMIZAR BD)
// =====================================================

// Limpar anúncios gratuitos (sem boost) com mais de X dias
adminRoutes.post('/marketplace/cleanup-old-listings', adminMiddleware, auditMiddleware('CLEANUP_OLD_LISTINGS', 'MARKETPLACE'), async (c: any) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const daysOld = body.daysOld || 7; // Padrão: 7 dias
    const pool = getDbPool(c);

    const result = await executeInTransaction(pool, async (client) => {
      // Contar anúncios que serão deletados (para relatório)
      const countResult = await client.query(`
        SELECT COUNT(*) as total
        FROM marketplace_listings 
        WHERE status = 'ACTIVE' 
          AND (is_boosted = FALSE OR is_boosted IS NULL)
          AND created_at < NOW() - INTERVAL '${daysOld} days'
      `);
      const countToDelete = parseInt(countResult.rows[0].total);

      if (countToDelete === 0) {
        return { deletedCount: 0 };
      }

      // Primeiro, obter os IDs dos anúncios que serão excluídos
      const listingsToDelete = await client.query(`
        SELECT id FROM marketplace_listings 
        WHERE status = 'ACTIVE' 
          AND (is_boosted = FALSE OR is_boosted IS NULL)
          AND created_at < NOW() - INTERVAL '${daysOld} days'
      `);
      const idsToDelete = listingsToDelete.rows.map(r => r.id);

      // Verificar se há pedidos pendentes vinculados a esses anúncios
      const ordersCheck = await client.query(`
        SELECT listing_id FROM marketplace_orders 
        WHERE listing_id = ANY($1) 
          AND status NOT IN ('COMPLETED', 'CANCELLED')
      `, [idsToDelete]);

      if (ordersCheck.rows.length > 0) {
        // Remover IDs que têm pedidos pendentes
        const idsWithOrders = ordersCheck.rows.map(r => r.listing_id);
        const safeIdsToDelete = idsToDelete.filter(id => !idsWithOrders.includes(id));

        if (safeIdsToDelete.length === 0) {
          return { deletedCount: 0, skipped: idsWithOrders.length };
        }

        // Deletar apenas os seguros
        const deleteResult = await client.query(`
          DELETE FROM marketplace_listings 
          WHERE id = ANY($1)
          RETURNING id
        `, [safeIdsToDelete]);

        return {
          deletedCount: deleteResult.rowCount || 0,
          skipped: idsWithOrders.length
        };
      }

      // Deletar todos os anúncios identificados
      const deleteResult = await client.query(`
        DELETE FROM marketplace_listings 
        WHERE id = ANY($1)
        RETURNING id
      `, [idsToDelete]);

      return { deletedCount: deleteResult.rowCount || 0 };
    });

    if (!result.success) {
      return c.json({ success: false, message: result.error }, 400);
    }

    const { deletedCount, skipped } = result.data!;
    let message = `Limpeza concluída: ${deletedCount} anúncio(s) removido(s).`;
    if (skipped) {
      message += ` ${skipped} anúncio(s) com pedidos pendentes foram mantidos.`;
    }

    return c.json({
      success: true,
      message,
      data: { deletedCount, skipped: skipped || 0, daysOld }
    });
  } catch (error: any) {
    console.error('[CLEANUP] Erro ao limpar anúncios:', error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Obter estatísticas de anúncios para limpeza
adminRoutes.get('/marketplace/cleanup-stats', adminMiddleware, async (c: any) => {
  try {
    const pool = getDbPool(c);

    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND (is_boosted = FALSE OR is_boosted IS NULL) AND created_at < NOW() - INTERVAL '7 days') as stale_7_days,
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND (is_boosted = FALSE OR is_boosted IS NULL) AND created_at < NOW() - INTERVAL '14 days') as stale_14_days,
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND (is_boosted = FALSE OR is_boosted IS NULL) AND created_at < NOW() - INTERVAL '30 days') as stale_30_days,
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND is_boosted = TRUE) as boosted_active,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as total_active,
        COUNT(*) as total_all
      FROM marketplace_listings
    `);

    const stats = result.rows[0];

    return c.json({
      success: true,
      data: {
        stale7Days: parseInt(stats.stale_7_days),
        stale14Days: parseInt(stats.stale_14_days),
        stale30Days: parseInt(stats.stale_30_days),
        boostedActive: parseInt(stats.boosted_active),
        totalActive: parseInt(stats.total_active),
        totalAll: parseInt(stats.total_all)
      }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// ==========================================
// SEED: Popular dados de demonstração
// ==========================================
adminRoutes.post('/seed-demo-data', adminMiddleware, async (c: any) => {
  try {
    const pool = getDbPool(c);
    const user = c.get('user');

    // 1. Inserir Vídeos Promocionais
    await pool.query(`
      INSERT INTO promo_videos (user_id, title, description, video_url, thumbnail_url, platform, duration_seconds, price_per_view, min_watch_seconds, budget, status, is_active, is_approved, daily_limit, target_views, expires_at)
      VALUES 
        ($1, 'Como Economizar R$ 500 por Mês', 'Dicas práticas para organizar suas finanças.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', 'YOUTUBE', 180, 0.03, 30, 1000.00, 'ACTIVE', true, true, 500, 5000, CURRENT_TIMESTAMP + INTERVAL '30 days'),
        ($1, 'O que é uma Cooperativa de Crédito?', 'Entenda como funcionam as cooperativas.', 'https://www.youtube.com/watch?v=2Z4m4lnjxkY', 'https://img.youtube.com/vi/2Z4m4lnjxkY/maxresdefault.jpg', 'YOUTUBE', 240, 0.03, 30, 500.00, 'ACTIVE', true, true, 300, 3000, CURRENT_TIMESTAMP + INTERVAL '30 days'),
        ($1, 'Primeiros Passos nos Investimentos', 'Aprenda a investir com pouco dinheiro.', 'https://www.youtube.com/watch?v=J---aiyznGQ', 'https://img.youtube.com/vi/J---aiyznGQ/maxresdefault.jpg', 'YOUTUBE', 300, 0.03, 45, 750.00, 'ACTIVE', true, true, 400, 4000, CURRENT_TIMESTAMP + INTERVAL '30 days'),
        ($1, 'Como Começar um Negócio com Pouco Dinheiro', 'Ideias de negócios para começar.', 'https://www.youtube.com/watch?v=9bZkp7q19f0', 'https://img.youtube.com/vi/9bZkp7q19f0/maxresdefault.jpg', 'YOUTUBE', 420, 0.03, 60, 600.00, 'ACTIVE', true, true, 350, 3500, CURRENT_TIMESTAMP + INTERVAL '30 days'),
        ($1, 'Saia das Dívidas em 6 Meses', 'Método comprovado para quitar dívidas.', 'https://www.youtube.com/watch?v=kJQP7kiw5Fk', 'https://img.youtube.com/vi/kJQP7kiw5Fk/maxresdefault.jpg', 'YOUTUBE', 360, 0.03, 45, 800.00, 'ACTIVE', true, true, 400, 4000, CURRENT_TIMESTAMP + INTERVAL '30 days')
      ON CONFLICT DO NOTHING
    `, [user.id]);

    // 2. Inserir Propostas de Governança
    await pool.query(`
      INSERT INTO governance_proposals (title, description, creator_id, status, category, min_power_quorum, expires_at)
      VALUES 
        ('Redução da Taxa de Saque de 3% para 2%', 'Proposta para reduzir a taxa cobrada em saques via PIX de 3% para 2%.', $1, 'active', 'financial', 50.00, CURRENT_TIMESTAMP + INTERVAL '7 days'),
        ('Criação do Programa de Mentoria Financeira', 'Implementar um programa onde membros com alta reputação possam mentorar novos associados.', $1, 'active', 'general', 30.00, CURRENT_TIMESTAMP + INTERVAL '14 days'),
        ('Aumento do Bônus de Indicação para R$ 10', 'Aumentar o bônus que o indicador recebe de R$ 5 para R$ 10.', $1, 'active', 'financial', 40.00, CURRENT_TIMESTAMP + INTERVAL '10 days')
      ON CONFLICT DO NOTHING
    `, [user.id]);

    // 3. Inserir Cursos da Academy
    await pool.query(`
      INSERT INTO academy_courses (author_id, title, description, price, video_url, thumbnail_url, category, status)
      VALUES
        ($1, 'Fundamentos de Educação Financeira', 'Aprenda os conceitos básicos de finanças pessoais.', 0.00, 'https://www.youtube.com/watch?v=example1', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600', 'Finanças', 'APPROVED'),
        ($1, 'Investindo do Zero ao Avançado', 'Curso completo sobre investimentos.', 29.90, 'https://www.youtube.com/watch?v=example2', 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600', 'Investimentos', 'APPROVED'),
        ($1, 'Empreendedorismo Digital', 'Como criar um negócio online lucrativo.', 49.90, 'https://www.youtube.com/watch?v=example3', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600', 'Negócios', 'APPROVED'),
        ($1, 'Marketing para Pequenos Negócios', 'Estratégias de marketing de baixo custo.', 19.90, 'https://www.youtube.com/watch?v=example4', 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=600', 'Marketing', 'APPROVED')
      ON CONFLICT DO NOTHING
    `, [user.id]);

    // 4. Inserir Produtos Afiliados
    await pool.query(`
      INSERT INTO products (title, description, image_url, affiliate_url, price, category, active)
      VALUES
        ('Cartão de Crédito Nubank', 'Cartão sem anuidade, aplicativo completo.', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600', 'https://nubank.com.br/convite', 0.00, 'Financeiro', true),
        ('Conta Digital Inter', 'Conta 100% gratuita com cartão de débito e crédito.', 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600', 'https://inter.co/convite', 0.00, 'Financeiro', true),
        ('Curso de Excel Avançado', 'Domine o Excel e aumente suas chances no mercado.', 'https://images.unsplash.com/photo-1537432376149-e84978e88917?w=600', 'https://hotmart.com/excel', 97.00, 'Cursos', true),
        ('Empréstimo FGTS Caixa', 'Antecipe seu FGTS com as menores taxas.', 'https://images.unsplash.com/photo-1554224155-16974a4005d1?w=600', 'https://caixa.gov.br/fgts', 0.00, 'Financeiro', true)
      ON CONFLICT DO NOTHING
    `);

    return c.json({
      success: true,
      message: 'Dados de demonstração inseridos com sucesso!',
      data: {
        videos: 5,
        proposals: 3,
        courses: 4,
        products: 4
      }
    });
  } catch (error: any) {
    console.error('[SEED] Erro ao inserir dados demo:', error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

export { adminRoutes };

