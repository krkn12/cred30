import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, securityLockMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';
import { executeInTransaction, lockUserBalance, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';
import { checkLiquidity } from '../../../application/services/liquidity.service';
import { financialRateLimit } from '../middleware/rate-limit.middleware';

const transactionRoutes = new Hono();

// Aplicar rate limiting a operações financeiras
transactionRoutes.use('/withdraw', financialRateLimit);

// Esquema de validação para saque
const withdrawSchema = z.object({
  amount: z.number().positive(),
  pixKey: z.string().min(5),
});

// Listar transações do usuário com paginação
transactionRoutes.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);
    const { limit, offset } = c.req.query();
    const limitNum = parseInt(limit || '20');
    const offsetNum = parseInt(offset || '0');

    // Buscar total de transações para paginação
    const totalResult = await pool.query(
      'SELECT COUNT(*) FROM transactions WHERE user_id = $1',
      [user.id]
    );
    const total = parseInt(totalResult.rows[0].count);

    // Buscar transações do usuário paginadas
    const result = await pool.query(
      `SELECT t.id, t.user_id, t.type, t.amount, t.description, t.status, t.metadata, t.created_at as date,
              u.name as user_name, u.email as user_email
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limitNum, offsetNum]
    );

    // Formatar transações para resposta
    const formattedTransactions = result.rows.map(transaction => {
      const transactionDate = new Date(transaction.date);
      // Ajustar para fuso horário de Brasília (UTC-3)
      const brasiliaDate = new Date(transactionDate.getTime() - (3 * 60 * 60 * 1000));

      return {
        id: transaction.id,
        userId: transaction.user_id,
        type: transaction.type,
        amount: parseFloat(transaction.amount),
        date: brasiliaDate.getTime(),
        description: transaction.description,
        status: transaction.status,
        metadata: transaction.metadata,
        user_name: transaction.user_name,
        user_email: transaction.user_email,
      };
    });

    return c.json({
      success: true,
      data: {
        transactions: formattedTransactions,
      },
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total
      }
    });
  } catch (error) {
    console.error('Erro ao listar transações:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Solicitar saque - AUTOMÁTICO via Asaas
transactionRoutes.post('/withdraw', authMiddleware, securityLockMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { amount, pixKey } = withdrawSchema.parse(body);

    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Validar valor mínimo e máximo
    if (amount <= 0) {
      return c.json({
        success: false,
        message: 'Valor deve ser maior que zero'
      }, 400);
    }

    if (amount > 10000) {
      return c.json({
        success: false,
        message: 'Valor máximo por saque é R$ 10.000,00'
      }, 400);
    }

    // Validar chave PIX
    if (!pixKey || pixKey.length < 5) {
      return c.json({
        success: false,
        message: 'Chave PIX inválida'
      }, 400);
    }

    // Verificar se usuário tem CPF cadastrado (obrigatório para saque)
    const userCheck = await pool.query(
      'SELECT cpf, name, email FROM users WHERE id = $1',
      [user.id]
    );

    if (!userCheck.rows[0]?.cpf) {
      return c.json({
        success: false,
        message: 'CPF obrigatório para realizar saques. Cadastre seu CPF nas configurações do perfil.',
        code: 'CPF_REQUIRED'
      }, 400);
    }

    // Buscar valor total de cotas ativas do cliente
    const quotasResult = await pool.query(
      "SELECT COALESCE(SUM(current_value), 0) as total_quota_value FROM quotas WHERE user_id = $1 AND status = 'ACTIVE'",
      [user.id]
    );
    const totalQuotaValue = parseFloat(quotasResult.rows[0].total_quota_value);

    // Calcular taxa de saque: se o valor da cota for maior que o saque, o saque é grátis
    let fee = 0;
    if (totalQuotaValue < amount) {
      fee = Math.max(5, amount * 0.02);
    }
    const netAmount = amount - fee;

    // Executar operação dentro de transação ACID
    const result = await executeInTransaction(pool, async (client) => {
      // Verificar e bloquear saldo
      const balanceCheck = await lockUserBalance(client, user.id, amount);
      if (!balanceCheck.success) {
        throw new Error(balanceCheck.error);
      }

      // VERIFICAÇÃO DE LIQUIDEZ - Evita quebra de caixa
      const liquidityCheck = await checkLiquidity(client, netAmount);
      if (!liquidityCheck.isLiquid) {
        throw new Error(liquidityCheck.message || 'Liquidez temporariamente insuficiente. Tente novamente mais tarde.');
      }

      // Deduzir saldo do usuário
      const updateResult = await updateUserBalance(client, user.id, amount, 'debit');
      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      // Adicionar taxa ao lucro do sistema
      if (fee > 0) {
        await client.query(
          'UPDATE system_config SET profit_pool = profit_pool + $1',
          [fee]
        );
      }

      // PIX Manual - Saque será processado manualmente pelo admin
      // Criar transação de saque PENDENTE
      const transactionResult = await createTransaction(
        client,
        user.id,
        'WITHDRAWAL',
        amount,
        `Saque pendente de processamento manual (PIX: ${pixKey})`,
        'PENDING',
        {
          pixKey,
          fee: fee,
          netAmount: netAmount,
          totalAmount: amount,
          payout_method: 'MANUAL_PIX'
        }
      );

      if (!transactionResult.success) {
        throw new Error(transactionResult.error);
      }

      // Atualizar payout_status na transação
      await client.query(
        "UPDATE transactions SET payout_status = $1 WHERE id = $2",
        ['PENDING_PAYMENT', transactionResult.transactionId]
      );

      // Criar notificação para o usuário
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.id,
          '⏳ Saque Solicitado',
          `Seu saque de R$ ${netAmount.toFixed(2)} foi registrado. O PIX será enviado para sua chave em até 24h úteis.`,
          'WITHDRAWAL_PENDING',
          JSON.stringify({
            transactionId: transactionResult.transactionId,
            amount: netAmount,
            pixKey: pixKey
          }),
          new Date()
        ]
      );

      return {
        transactionId: transactionResult.transactionId,
        newBalance: updateResult.newBalance,
        fee: fee,
        netAmount: netAmount
      };
    });

    if (!result.success) {
      return c.json({
        success: false,
        message: result.error
      }, 400);
    }

    return c.json({
      success: true,
      message: 'Saque registrado! O PIX será enviado para sua chave em até 24h úteis.',
      data: {
        transactionId: result.data?.transactionId,
        newBalance: result.data?.newBalance,
        fee: result.data?.fee,
        netAmount: result.data?.netAmount,
        message: `⏳ Saque registrado. Taxa: R$ ${result.data?.fee.toFixed(2)}. Valor líquido: R$ ${result.data?.netAmount.toFixed(2)}`
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    return c.json({ success: false, message: error instanceof Error ? error.message : 'Erro interno do servidor' }, 500);
  }
});


// Obter saldo do usuário
transactionRoutes.get('/balance', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;

    return c.json({
      success: true,
      data: {
        balance: user.balance,
      },
    });
  } catch (error) {
    console.error('Erro ao obter saldo:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Solicitar Depósito (Manual)
transactionRoutes.post('/deposit', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);
    const body = await c.req.json();
    const { amount } = z.object({ amount: z.number().positive() }).parse(body);

    const result = await createTransaction(
      pool,
      user.id,
      'DEPOSIT',
      amount,
      'Depósito manual pendente de confirmação',
      'PENDING',
      { method: 'MANUAL_PIX' }
    );

    if (!result.success) throw new Error(result.error);

    return c.json({
      success: true,
      message: 'Solicitação de depósito registrada. Prossiga com o pagamento PIX.',
      data: { transactionId: result.transactionId }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Erro ao registrar depósito' }, 500);
  }
});




// Schema de avaliação
const reviewSchema = z.object({
  transactionId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  isPublic: z.boolean().optional().default(false),
});

// Enviar avaliação de transação (saque)
transactionRoutes.post('/review', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { transactionId, rating, comment, isPublic } = reviewSchema.parse(body);

    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Verificar se a transação existe e pertence ao usuário
    const txCheck = await pool.query(
      "SELECT id, payout_status FROM transactions WHERE id = $1 AND user_id = $2 AND type = 'WITHDRAWAL'",
      [transactionId, user.id]
    );

    if (txCheck.rows.length === 0) {
      return c.json({ success: false, message: 'Transação não encontrada ou não pertence a você' }, 404);
    }

    if (txCheck.rows[0].payout_status !== 'PAID') {
      return c.json({ success: false, message: 'Você só pode avaliar saques já processados' }, 400);
    }

    // Verificar se já existe avaliação
    const existingReview = await pool.query(
      'SELECT id FROM transaction_reviews WHERE transaction_id = $1',
      [transactionId]
    );

    if (existingReview.rows.length > 0) {
      return c.json({ success: false, message: 'Você já avaliou esta transação' }, 400);
    }

    // Inserir avaliação
    await pool.query(
      `INSERT INTO transaction_reviews (transaction_id, user_id, rating, comment, is_public, is_approved, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [transactionId, user.id, rating, comment || null, isPublic, false, new Date()]
    );

    // Bônus de score por avaliar
    await pool.query(
      'UPDATE users SET score = LEAST(score + 2, 1000) WHERE id = $1',
      [user.id]
    );

    return c.json({
      success: true,
      message: 'Obrigado pela sua avaliação! +2 pontos de Score.',
      data: { rating, comment }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }
    console.error('Erro ao enviar avaliação:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Listar avaliações públicas aprovadas (depoimentos)
transactionRoutes.get('/reviews/public', async (c) => {
  try {
    const pool = getDbPool(c);

    const result = await pool.query(`
      SELECT r.rating, r.comment, r.created_at, u.name as user_name
      FROM transaction_reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.is_public = TRUE AND r.is_approved = TRUE
      ORDER BY r.created_at DESC
      LIMIT 20
    `);

    // Anonimizar nomes (mostrar só primeiro nome e inicial do sobrenome)
    const testimonials = result.rows.map(row => {
      const nameParts = row.user_name.split(' ');
      const firstName = nameParts[0];
      const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0] + '.' : '';

      return {
        rating: row.rating,
        comment: row.comment,
        userName: `${firstName} ${lastInitial}`.trim(),
        createdAt: row.created_at
      };
    });

    return c.json({
      success: true,
      data: { testimonials }
    });
  } catch (error) {
    console.error('Erro ao listar depoimentos:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Buscar transações pendentes de avaliação
transactionRoutes.get('/pending-reviews', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    const result = await pool.query(`
      SELECT t.id, t.amount, t.processed_at, t.metadata
      FROM transactions t
      LEFT JOIN transaction_reviews r ON t.id = r.transaction_id
      WHERE t.user_id = $1 
        AND t.type = 'WITHDRAWAL' 
        AND t.payout_status = 'PAID'
        AND r.id IS NULL
      ORDER BY t.processed_at DESC
    `, [user.id]);

    const pendingReviews = result.rows.map(row => ({
      transactionId: row.id,
      amount: parseFloat(row.amount),
      processedAt: row.processed_at,
      pixKey: row.metadata?.pixKey || 'N/A'
    }));

    return c.json({
      success: true,
      data: { pendingReviews }
    });
  } catch (error) {
    console.error('Erro ao buscar avaliações pendentes:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

export { transactionRoutes };
