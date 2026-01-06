import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';
import bcrypt from 'bcrypt';
import { twoFactorService } from '../../../application/services/two-factor.service';
import { getWelcomeBenefit, getWelcomeBenefitDescription } from '../../../application/services/welcome-benefit.service';
import { WELCOME_BENEFIT_MAX_USES } from '../../../shared/constants/business.constants';

const userRoutes = new Hono();

// Esquema de validação para atualização de usuário
const updateUserSchema = z.object({
  name: z.string().min(3).optional(),
  pixKey: z.string().min(5).optional(),
  secretPhrase: z.string().min(3).optional(),
  panicPhrase: z.string().min(3).optional(),
  safeContactPhone: z.string().min(8).optional(),
  // Campos de confirmação de segurança
  confirmationCode: z.string().optional(), // 2FA
  password: z.string().min(1).optional(), // Backup se 2FA off
});

// Obter perfil do usuário atual
userRoutes.get('/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;

    return c.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Erro ao obter perfil:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Atualizar perfil do usuário
userRoutes.put('/profile', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = updateUserSchema.parse(body);

    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // 1. VERIFICAÇÃO DE SEGURANÇA PARA CAMPOS SENSÍVEIS (PIX, Frases ou Contato Seguro)
    const isSensitiveChange = validatedData.pixKey || validatedData.secretPhrase || validatedData.panicPhrase || validatedData.safeContactPhone;

    if (isSensitiveChange) {
      // Buscar dados atuais de segurança
      const securityRes = await pool.query(
        'SELECT password_hash, two_factor_enabled, two_factor_secret FROM users WHERE id = $1',
        [user.id]
      );
      const securityData = securityRes.rows[0];

      if (securityData.two_factor_enabled) {
        if (!validatedData.confirmationCode) {
          return c.json({ success: false, message: 'Código de autenticação necessário para alterar dados sensíveis.' }, 403);
        }
        const isValid = twoFactorService.verifyToken(validatedData.confirmationCode, securityData.two_factor_secret);
        if (!isValid) return c.json({ success: false, message: 'Código de autenticação inválido.' }, 401);
      } else {
        if (!validatedData.password) {
          return c.json({ success: false, message: 'Senha necessária para alterar dados sensíveis.' }, 403);
        }
        const isMatch = await bcrypt.compare(validatedData.password, securityData.password_hash);
        if (!isMatch) return c.json({ success: false, message: 'Senha incorreta.' }, 401);
      }
    }

    // Verificar se a nova frase secreta já existe em outro usuário
    if (validatedData.secretPhrase) {
      const existingUserResult = await pool.query(
        'SELECT id FROM users WHERE secret_phrase = $1 AND id != $2',
        [validatedData.secretPhrase, user.id]
      );

      if (existingUserResult.rows.length > 0) {
        return c.json({ success: false, message: 'Frase secreta já em uso' }, 409);
      }
    }

    // Preparar campos de atualização
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (validatedData.name) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(validatedData.name);
    }
    if (validatedData.pixKey) {
      updateFields.push(`pix_key = $${paramIndex++}`);
      updateValues.push(validatedData.pixKey);
    }
    if (validatedData.secretPhrase) {
      updateFields.push(`secret_phrase = $${paramIndex++}`);
      updateValues.push(validatedData.secretPhrase);
    }
    if (validatedData.panicPhrase) {
      updateFields.push(`panic_phrase = $${paramIndex++}`);
      updateValues.push(validatedData.panicPhrase);
    }
    if (validatedData.safeContactPhone) {
      updateFields.push(`safe_contact_phone = $${paramIndex++}`);
      updateValues.push(validatedData.safeContactPhone);
    }

    // Se houve mudança sensível, aplicar o LOCK de saque de 48h
    if (isSensitiveChange) {
      updateFields.push(`security_lock_until = $${paramIndex++}`);
      const lockDate = new Date();
      lockDate.setHours(lockDate.getHours() + 48); // 48 horas de trava
      updateValues.push(lockDate);
    }

    if (updateFields.length === 0) {
      return c.json({ success: false, message: 'Nenhum campo para atualizar' }, 400);
    }

    // Adicionar ID do usuário no final
    updateValues.push(user.id);

    // Atualizar usuário
    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, pix_key, balance, score, created_at, referral_code, is_admin, video_points
    `;

    const result = await pool.query(updateQuery, updateValues);

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    const updatedUser = result.rows[0];

    return c.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: {
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          pixKey: updatedUser.pix_key,
          balance: parseFloat(updatedUser.balance),
          joinedAt: updatedUser.created_at,
          referralCode: updatedUser.referral_code,
          isAdmin: updatedUser.is_admin,
          video_points: updatedUser.video_points
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    console.error('Erro ao atualizar perfil:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Obter saldo do usuário
userRoutes.get('/balance', authMiddleware, async (c) => {
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

/**
 * Endpoint de Sincronização Consolidada (Otimização Máxima de Performance)
 * Retorna todos os dados vitais para a home em uma única chamada de banco.
 */
userRoutes.get('/sync', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Consulta consolidada usando subqueries e agregação JSON para performance extrema
    const result = await pool.query(`
      WITH user_stats AS (
        SELECT 
          u.balance,
          u.score,
          u.membership_type,
          u.is_verified,
          u.is_seller,
          u.security_lock_until,
          u.video_points,
          COALESCE(u.ad_points, 0) as ad_points,
          u.phone,
          u.address,
          u.referred_by,
          COALESCE(u.total_dividends_earned, 0) as total_dividends_earned,
          u.last_login_at,
          (SELECT COUNT(*) FROM quotas WHERE user_id = u.id AND status = 'ACTIVE') as quota_count,
          (SELECT COALESCE(SUM(total_repayment), 0) FROM loans WHERE user_id = u.id AND status IN ('APPROVED', 'PAYMENT_PENDING')) as debt_total
        FROM users u WHERE u.id = $1
      ),
      recent_tx AS (
        SELECT json_agg(t) FROM (
          SELECT id, type, amount, created_at as date, description, status, metadata
          FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20
        ) t
      ),
      active_quotas AS (
        SELECT json_agg(q) FROM (
          SELECT id, user_id as "userId", purchase_price as "purchasePrice", current_value as "currentValue", purchase_date as "purchaseDate", status, yield_rate as "yieldRate"
          FROM quotas WHERE user_id = $1 ORDER BY purchase_date DESC
        ) q
      ),
      active_loans AS (
        SELECT json_agg(l) FROM (
          SELECT 
            ln.id, 
            ln.user_id as "userId", 
            ln.amount::float as amount, 
            ln.total_repayment::float as "totalRepayment", 
            ln.installments, 
            ln.interest_rate::float as "interestRate", 
            ln.status, 
            ln.created_at as "createdAt", 
            ln.due_date as "dueDate",
            COALESCE((SELECT SUM(li.amount::float) FROM loan_installments li WHERE li.loan_id = ln.id), 0) as "totalPaid",
            ln.total_repayment::float - COALESCE((SELECT SUM(li.amount::float) FROM loan_installments li WHERE li.loan_id = ln.id), 0) as "remainingAmount",
            (SELECT COUNT(*) FROM loan_installments li WHERE li.loan_id = ln.id)::int as "paidInstallmentsCount",
            CASE WHEN COALESCE((SELECT SUM(li.amount::float) FROM loan_installments li WHERE li.loan_id = ln.id), 0) >= ln.total_repayment::float THEN true ELSE false END as "isFullyPaid"
          FROM loans ln WHERE ln.user_id = $1 ORDER BY ln.created_at DESC
        ) l
      )
      SELECT 
        (SELECT row_to_json(us) FROM user_stats us) as user_stats,
        (SELECT * FROM recent_tx) as transactions,
        (SELECT * FROM active_quotas) as quotas,
        (SELECT * FROM active_loans) as loans
    `, [user.id]);

    const data = result.rows[0];
    const stats = data.user_stats;

    if (!stats) {
      console.error(`[SYNC_ERROR] Usuário ${user.id} não encontrado no banco de dados durante o sync.`);
      return c.json({ success: false, message: 'Usuário não sincronizado' }, 404);
    }

    // Obter benefício de boas-vindas (Indicação)
    const welcomeBenefit = await getWelcomeBenefit(pool, user.id);

    return c.json({
      success: true,
      data: {
        user: {
          ...user,
          balance: parseFloat(stats.balance || '0'),
          score: stats.score || 0,
          membership_type: stats.membership_type || 'FREE',
          is_verified: stats.is_verified || false,
          is_seller: stats.is_seller || false,
          security_lock_until: stats.security_lock_until,
          video_points: stats.video_points || 0,
          ad_points: parseInt(stats.ad_points || '0'),
          phone: stats.phone || null,
          address: stats.address || null,
          referred_by: stats.referred_by || null,
          total_dividends_earned: parseFloat(stats.total_dividends_earned || '0'),
          last_login_at: stats.last_login_at
        },
        stats: {
          activeQuotas: parseInt(stats.quota_count || '0'),
          debtTotal: parseFloat(stats.debt_total || '0'),
          securityLock: stats.security_lock_until && new Date(stats.security_lock_until) > new Date() ? stats.security_lock_until : null
        },
        transactions: data.transactions || [],
        quotas: data.quotas || [],
        loans: data.loans || [],
        welcomeBenefit: {
          ...welcomeBenefit,
          maxUses: WELCOME_BENEFIT_MAX_USES,
          description: getWelcomeBenefitDescription(welcomeBenefit),
          discountedRates: welcomeBenefit.hasDiscount ? {
            loanInterestRate: `${((welcomeBenefit.loanInterestRate || 0) * 100).toFixed(1)}%`,
            loanOriginationFeeRate: `${((welcomeBenefit.loanOriginationFeeRate || 0) * 100).toFixed(1)}%`,
            withdrawalFee: `R$ ${(welcomeBenefit.withdrawalFee || 0).toFixed(2)}`,
            marketplaceEscrowFeeRate: `${((welcomeBenefit.marketplaceEscrowFeeRate || 0) * 100).toFixed(1)}%`
          } : null
        }
      }
    });
  } catch (error: any) {
    console.error('Erro no Super Sync:', error.message, error.stack);
    return c.json({ success: false, message: 'Erro ao sincronizar dados consolidados' }, 500);
  }
});

// Obter extrato de transações do usuário (Otimizado com Paginação)
userRoutes.get('/transactions', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Parâmetros de paginação
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    // Buscar transações com limite e offset
    const result = await pool.query(
      `SELECT id, type, amount, created_at as date, description, status, metadata
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    // Contar total para ajudar na paginação do frontend
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM transactions WHERE user_id = $1',
      [user.id]
    );

    const formattedTransactions = result.rows.map(transaction => ({
      id: transaction.id,
      type: transaction.type,
      amount: parseFloat(transaction.amount),
      date: transaction.date,
      description: transaction.description,
      status: transaction.status,
      metadata: transaction.metadata,
    }));

    return c.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          total: parseInt(countResult.rows[0].count),
          limit,
          offset
        }
      },
    });
  } catch (error) {
    console.error('Erro ao obter transações:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Excluir conta do usuário
userRoutes.delete('/me', authMiddleware, async (c) => {
  const user = c.get('user') as UserContext;
  const pool = getDbPool(c);

  try {
    const body = await c.req.json().catch(() => ({}));
    const { twoFactorCode } = body;

    // Buscar status do 2FA no banco (para garantir que está atualizado)
    const userRes = await pool.query('SELECT two_factor_enabled, two_factor_secret FROM users WHERE id = $1', [user.id]);
    const dbUser = userRes.rows[0];

    if (dbUser.two_factor_enabled) {
      if (!twoFactorCode) {
        return c.json({ success: false, message: 'Código de autenticação necessário para excluir a conta.' }, 400);
      }

      const isValid = twoFactorService.verifyToken(twoFactorCode, dbUser.two_factor_secret);
      if (!isValid) {
        return c.json({ success: false, message: 'Código de autenticação inválido.' }, 401);
      }
    }
    // 1. Verificar Pendências Financeiras

    // Empréstimos Ativos
    const activeLoans = await pool.query(
      "SELECT id FROM loans WHERE user_id = $1 AND status IN ('PENDING', 'APPROVED')",
      [user.id]
    );
    if (activeLoans.rows.length > 0) {
      return c.json({ success: false, message: 'Não é possível excluir conta com empréstimos ativos ou pendentes.' }, 400);
    }

    // Cotas Ativas (Forçar venda para não perder dinheiro sem querer)
    const activeQuotas = await pool.query(
      "SELECT count(*) FROM quotas WHERE user_id = $1 AND status = 'ACTIVE'",
      [user.id]
    );
    if (parseInt(activeQuotas.rows[0].count) > 0) {
      return c.json({ success: false, message: 'Venda todas as suas cotas antes de excluir a conta.' }, 400);
    }

    // Saldo positivo relevante (> R$ 1.00)
    const currentUserRes = await pool.query('SELECT balance FROM users WHERE id = $1', [user.id]);
    const balance = parseFloat(currentUserRes.rows[0].balance);
    if (balance > 1.00) {
      return c.json({ success: false, message: `Você ainda possui saldo (R$ ${balance.toFixed(2)}). Realize um saque antes de excluir.` }, 400);
    }

    // 2. Realizar Exclusão Lógica (Anonimização) para manter integridade contábil
    await pool.query(`
        UPDATE users 
        SET name = 'Usuário Excluído', 
            email = 'deleted_' || id || '_' || EXTRACT(EPOCH FROM NOW()) || '@deleted.com', 
            password_hash = 'DELETED', 
            pix_key = 'DELETED', 
            secret_phrase = 'DELETED_' || id,
            is_admin = false,
            referral_code = NULL,
            balance = 0
        WHERE id = $1
    `, [user.id]);

    return c.json({ success: true, message: 'Conta encerrada com sucesso.' });

  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    return c.json({ success: false, message: 'Erro interno ao processar exclusão.' }, 500);
  }
});

// Alterar senha do usuário
userRoutes.post('/change-password', authMiddleware, async (c) => {
  try {
    const { oldPassword, newPassword } = await c.req.json();
    const userContext = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Buscar hash da senha atual
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userContext.id]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    const { password_hash } = result.rows[0];

    // Verificar se a senha antiga está correta
    const isMatch = await bcrypt.compare(oldPassword, password_hash);
    if (!isMatch) {
      return c.json({ success: false, message: 'Senha atual incorreta' }, 401);
    }

    // Hash da nova senha
    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualizar no banco
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newHashedPassword, userContext.id]
    );

    return c.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    return c.json({ success: false, message: 'Erro interno ao alterar senha' }, 500);
  }
});

// Atualizar CPF do usuário
userRoutes.post('/update-cpf', authMiddleware, async (c) => {
  try {
    const { cpf } = await c.req.json();
    const userContext = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Validar formato do CPF (apenas números, 11 dígitos)
    const cleanCpf = cpf?.replace(/\D/g, '');
    if (!cleanCpf || cleanCpf.length !== 11) {
      return c.json({ success: false, message: 'CPF inválido. Informe 11 dígitos.' }, 400);
    }

    // Verificar se CPF já está em uso por outro usuário
    const existingCpf = await pool.query(
      'SELECT id FROM users WHERE cpf = $1 AND id != $2',
      [cleanCpf, userContext.id]
    );

    if (existingCpf.rows.length > 0) {
      return c.json({ success: false, message: 'CPF já cadastrado por outro usuário.' }, 409);
    }

    // Atualizar CPF do usuário
    await pool.query(
      'UPDATE users SET cpf = $1 WHERE id = $2',
      [cleanCpf, userContext.id]
    );

    return c.json({ success: true, message: 'CPF atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar CPF:', error);
    return c.json({ success: false, message: 'Erro interno ao atualizar CPF' }, 500);
  }
});

// Atualizar Telefone do usuário
userRoutes.post('/update-phone', authMiddleware, async (c) => {
  try {
    const { phone } = await c.req.json();
    const userContext = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Validar formato (apenas números, 10 a 11 dígitos)
    const cleanPhone = phone?.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 11) {
      return c.json({ success: false, message: 'Telefone inválido. Informe 10 ou 11 dígitos com DDD.' }, 400);
    }

    // Atualizar no banco
    await pool.query(
      'UPDATE users SET phone = $1 WHERE id = $2',
      [cleanPhone, userContext.id]
    );

    return c.json({ success: true, message: 'Telefone atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar telefone:', error);
    return c.json({ success: false, message: 'Erro interno ao atualizar telefone' }, 500);
  }
});

// Recompensa por assistir anúncio (Gera Score - Seguro para o Caixa)
userRoutes.post('/reward-ad', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // 1. Verificar limite diário de GANHO DE SCORE (Anti-Farm)
    // O usuário pode ver ilimitados anúncios para ajudar a plataforma,
    // mas só ganha pontos nos primeiros X do dia.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkLimitRes = await pool.query(
      `SELECT count(*) FROM transactions 
       WHERE user_id = $1 AND type = 'AD_REWARD' AND created_at >= $2`,
      [user.id, today]
    );

    const adsWithScoreToday = parseInt(checkLimitRes.rows[0].count);
    const DAILY_SCORE_LIMIT_ADS = 3; // 3 ads * 5 pts = 15 pts max

    let scoreReward = 0;
    let message = 'Obrigado por ajudar a Cred30!';

    if (adsWithScoreToday < DAILY_SCORE_LIMIT_ADS) {
      scoreReward = 5;
      await pool.query(
        'UPDATE users SET score = score + $1 WHERE id = $2',
        [scoreReward, user.id]
      );
      message = `Parabéns! Você ganhou +${scoreReward} pontos de Score!`;
    } else {
      message = 'Limite diário de pontos atingido, mas obrigado por apoiar o projeto!';
    }

    // 3. Registrar a transação para controle de log e limite
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, status, description, metadata)
       VALUES ($1, 'AD_REWARD', 0, 'APPROVED', $2, $3)`,
      [
        user.id,
        `Visualização de anúncio ${scoreReward > 0 ? `(+${scoreReward} pts)` : '(Apoio)'}`,
        JSON.stringify({ scoreRewarded: scoreReward, adType: 'rewarded_video' })
      ]
    );

    return c.json({
      success: true,
      message,
      data: {
        scoreRewarded: scoreReward,
        adsToday: adsWithScoreToday + (scoreReward > 0 ? 1 : 0)
      }
    });

  } catch (error) {
    console.error('Erro ao processar recompensa ad:', error);
    return c.json({ success: false, message: 'Erro ao processar sua recompensa.' }, 500);
  }
});

// Obter elegibilidade para o Título de Sócio Majoritário
userRoutes.get('/title-eligibility', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // 1. Verificar se já baixou
    const userRes = await pool.query('SELECT title_downloaded, created_at FROM users WHERE id = $1', [user.id]);
    const { title_downloaded } = userRes.rows[0];

    if (title_downloaded) {
      return c.json({
        success: true,
        data: { eligible: false, reason: 'Título já emitido e baixado anteriormente.' }
      });
    }

    // 2. Contar participações ativas
    const quotaRes = await pool.query(
      "SELECT count(*) FROM quotas WHERE user_id = $1 AND status = 'ACTIVE'",
      [user.id]
    );
    const quotaCount = parseInt(quotaRes.rows[0].count);

    // 3. Verificar data da cota mais antiga
    const oldestQuotaRes = await pool.query(
      "SELECT purchase_date FROM quotas WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY purchase_date ASC LIMIT 1",
      [user.id]
    );

    if (oldestQuotaRes.rows.length === 0) {
      return c.json({
        success: true,
        data: { eligible: false, reason: 'Você ainda não possui participações ativas.' }
      });
    }

    const oldestQuotaDate = oldestQuotaRes.rows[0].purchase_date;
    const oldestQuotaDateObj = new Date(oldestQuotaDate);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const hasOneYear = oldestQuotaDateObj <= oneYearAgo;
    const hasEnoughQuotas = quotaCount >= 500;

    if (!hasEnoughQuotas) {
      return c.json({
        success: true,
        data: {
          eligible: false,
          reason: `Você possui ${quotaCount} participações. São necessárias 500 para o título.`,
          currentCount: quotaCount,
          neededCount: 500
        }
      });
    }

    if (!hasOneYear) {
      const daysRemaining = Math.ceil((oldestQuotaDateObj.getTime() + (365 * 24 * 60 * 60 * 1000) - Date.now()) / (1000 * 60 * 60 * 24));
      return c.json({
        success: true,
        data: {
          eligible: false,
          reason: `Sua participação mais antiga tem menos de 1 ano. Faltam aproximadamente ${daysRemaining} dias.`,
          daysRemaining
        }
      });
    }

    return c.json({
      success: true,
      data: { eligible: true, message: 'Parabéns! Você é elegível ao Título de Sócio Majoritário.' }
    });

  } catch (error) {
    console.error('Erro ao verificar elegibilidade do título:', error);
    return c.json({ success: false, message: 'Erro ao verificar elegibilidade.' }, 500);
  }
});

// Registrar download do título
userRoutes.post('/title-download', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    // Repetir verificações por segurança
    const userRes = await pool.query('SELECT title_downloaded, name FROM users WHERE id = $1', [user.id]);
    if (userRes.rows[0].title_downloaded) {
      return c.json({ success: false, message: 'Título já emitido anteriormente.' }, 403);
    }

    const quotaRes = await pool.query("SELECT count(*) FROM quotas WHERE user_id = $1 AND status = 'ACTIVE'", [user.id]);
    const oldestQuotaRes = await pool.query("SELECT purchase_date FROM quotas WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY purchase_date ASC LIMIT 1", [user.id]);

    const quotaCount = parseInt(quotaRes.rows[0].count);
    const oldestQuotaDate = new Date(oldestQuotaRes.rows[0]?.purchase_date || Date.now());
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (quotaCount < 500 || oldestQuotaDate > oneYearAgo) {
      return c.json({ success: false, message: 'Requisitos não preenchidos para emissão do título.' }, 403);
    }

    // Marcar como baixado
    await pool.query(
      'UPDATE users SET title_downloaded = TRUE, title_downloaded_at = NOW() WHERE id = $1',
      [user.id]
    );

    return c.json({
      success: true,
      message: 'Título emitido com sucesso.',
      data: {
        userName: userRes.rows[0].name,
        issueDate: new Date().toLocaleDateString('pt-BR'),
        quotaCount
      }
    });

  } catch (error) {
    console.error('Erro ao registrar download de título:', error);
    return c.json({ success: false, message: 'Erro ao processar emissão.' }, 500);
  }
});

/**
 * Consultar status do Benefício de Boas-Vindas (Indicação)
 * Retorna se o usuário tem desconto ativo e quantos usos restam
 */
userRoutes.get('/welcome-benefit', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const pool = getDbPool(c);

    const benefit = await getWelcomeBenefit(pool, user.id);

    return c.json({
      success: true,
      data: {
        hasDiscount: benefit.hasDiscount,
        usesRemaining: benefit.usesRemaining,
        maxUses: WELCOME_BENEFIT_MAX_USES,
        description: getWelcomeBenefitDescription(benefit),
        discountedRates: benefit.hasDiscount ? {
          loanInterestRate: `${(benefit.loanInterestRate * 100).toFixed(1)}%`,
          loanOriginationFeeRate: `${(benefit.loanOriginationFeeRate * 100).toFixed(1)}%`,
          withdrawalFee: `R$ ${benefit.withdrawalFee.toFixed(2)}`,
          marketplaceEscrowFeeRate: `${(benefit.marketplaceEscrowFeeRate * 100).toFixed(1)}%`
        } : null,
        normalRates: {
          loanInterestRate: '20%',
          loanOriginationFeeRate: '3%',
          withdrawalFee: 'R$ 2,00',
          marketplaceEscrowFeeRate: '5%'
        }
      }
    });
  } catch (error) {
    console.error('Erro ao consultar benefício:', error);
    return c.json({ success: false, message: 'Erro ao consultar benefício' }, 500);
  }
});

export { userRoutes };