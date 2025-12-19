import { Hono } from 'hono';
import { sign } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { getDbPool, generateReferralCode } from '../../../infrastructure/database/postgresql/connection/pool';
import { authRateLimit } from '../middleware/rate-limit.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { twoFactorService } from '../../../application/services/two-factor.service';

const authRoutes = new Hono();

// Aplicar rate limiting às rotas de autenticação
authRoutes.post('/login', authRateLimit);
authRoutes.post('/register', authRateLimit);
authRoutes.post('/reset-password', authRateLimit);

// Esquemas de validação
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  secretPhrase: z.string().min(3).optional(), // Tornar opcional se usarmos 2FA
  twoFactorCode: z.string().length(6).optional(),
});

const registerSchema = z.object({
  name: z.string().min(5).refine(val => val.trim().split(/\s+/).length >= 2, "Informe seu Nome e Sobrenome reais"),
  email: z.string().email(),
  password: z.string().min(6),
  secretPhrase: z.string().min(3),
  pixKey: z.string().min(5),
  referralCode: z.string().optional(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  secretPhrase: z.string().min(3),
  newPassword: z.string().min(6),
});

// Rota de login
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = loginSchema.parse(body);

    const pool = getDbPool(c);

    // Buscar usuário no banco
    console.log('Buscando usuário com email:', validatedData.email);
    const result = await pool.query(
      'SELECT id, name, email, password_hash, secret_phrase, pix_key, referral_code, is_admin, balance, score, created_at, is_email_verified FROM users WHERE email = $1',
      [validatedData.email]
    );

    console.log('Resultado da consulta:', result.rows);

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    const user = result.rows[0];

    // Verificar se 2FA está habilitado e se o código foi enviado
    if (user.two_factor_enabled) {
      if (!validatedData.twoFactorCode) {
        return c.json({
          success: false,
          message: 'Código de autenticação necessário',
          requires2FA: true
        }, 200); // Retorna 200 com flag para o frontend mostrar o campo
      }

      const isValid = twoFactorService.verifyToken(validatedData.twoFactorCode, user.two_factor_secret);
      if (!isValid) {
        return c.json({ success: false, message: 'Código de autenticação inválido' }, 401);
      }
    }

    // Verificar senha e frase secreta (Frase secreta é backup se 2FA falhar ou se não tiver 2FA)
    const isPasswordValid = user.password_hash ?
      await bcrypt.compare(validatedData.password, user.password_hash) :
      validatedData.password === user.password_hash;

    if (!isPasswordValid) {
      return c.json({ success: false, message: 'Senha incorreta' }, 401);
    }

    // Se não tiver 2FA habilitado, exige a frase secreta
    if (!user.two_factor_enabled && user.secret_phrase !== validatedData.secretPhrase) {
      return c.json({ success: false, message: 'Frase secreta incorreta' }, 401);
    }

    if (!user.is_email_verified) {
      console.log('Email não verificado para:', user.email);
      return c.json({
        success: false,
        message: 'Por favor, verifique seu email para acessar a conta.',
        requiresVerification: true,
        email: user.email
      }, 403);
    }

    // Gerar token JWT
    const token = sign(
      { userId: user.id, isAdmin: user.is_admin },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    return c.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          pixKey: user.pix_key,
          balance: parseFloat(user.balance),
          joinedAt: user.created_at,
          referralCode: user.referral_code,
          isAdmin: user.is_admin,
          score: user.score,
          twoFactorEnabled: user.two_factor_enabled
        },
        token,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    console.error('Erro no login:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Rota de registro
authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = registerSchema.parse(body);

    const pool = getDbPool(c);

    // Verificar se email já existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [validatedData.email]
    );

    if (existingUser.rows.length > 0) {
      return c.json({ success: false, message: 'Email já cadastrado' }, 409);
    }

    // Verificar se chave PIX já existe
    const existingPix = await pool.query(
      'SELECT id FROM users WHERE pix_key = $1',
      [validatedData.pixKey]
    );

    if (existingPix.rows.length > 0) {
      return c.json({ success: false, message: 'Esta chave PIX já está vinculada a outra conta' }, 409);
    }

    // Verificar se já existe um administrador no sistema
    // Considerando tanto o admin hardcoded quanto usuários no banco
    const adminCheck = await pool.query(
      'SELECT id FROM users WHERE is_admin = true LIMIT 1'
    );

    console.log('Admin check result:', adminCheck.rows);
    console.log('Admin check count:', adminCheck.rows.length);
    console.log('Email being registered:', validatedData.email);

    // Modificação: Primeiro usuário será admin se não existirem admins no banco
    // O admin hardcoded não conta para esta verificação, pois ele não está no banco
    const isFirstUser = adminCheck.rows.length === 0;

    console.log('Is first user:', isFirstUser);

    // Hash da senha
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Verificar código de indicação e aplicar bônus
    if (validatedData.referralCode) {
      const referrerResult = await pool.query(
        'SELECT id FROM users WHERE referral_code = $1',
        [validatedData.referralCode.toUpperCase()]
      );

      if (referrerResult.rows.length > 0) {
        const referrerId = referrerResult.rows[0].id;

        // Aplicar bônus de indicação
        await pool.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [5.00, referrerId]
        );

        // Registrar transação de bônus
        await pool.query(
          'INSERT INTO transactions (user_id, type, amount, description, status) VALUES ($1, $2, $3, $4, $5)',
          [referrerId, 'REFERRAL_BONUS', 5.00, `Bônus indicação: ${validatedData.name}`, 'APPROVED']
        );
      }
    }

    // Criar novo usuário
    const referralCode = generateReferralCode();

    // GERAR 2FA (No lugar do código de email)
    const tfaSecret = twoFactorService.generateSecret();
    const otpUri = twoFactorService.generateOtpUri(validatedData.email, tfaSecret);
    const qrCode = await twoFactorService.generateQrCode(otpUri);

    const newUserResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, balance, referral_code, is_admin, score, two_factor_secret, two_factor_enabled, is_email_verified)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7, 300, $8, FALSE, TRUE)
       RETURNING id, name, email, pix_key, balance, score, created_at, referral_code, is_admin`,
      [
        validatedData.name,
        validatedData.email,
        hashedPassword,
        validatedData.secretPhrase,
        validatedData.pixKey,
        referralCode,
        isFirstUser,
        tfaSecret
      ]
    );

    const newUser = newUserResult.rows[0];

    // Gerar token JWT
    const token = sign(
      { userId: newUser.id, email: newUser.email, isAdmin: newUser.is_admin },
      process.env.JWT_SECRET!
    );

    return c.json({
      success: true,
      message: 'Cadastro iniciado! Configure seu autenticador para ativar a conta.',
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          pixKey: newUser.pix_key,
          balance: 0,
          joinedAt: newUser.created_at,
          referralCode: newUser.referral_code,
          isAdmin: newUser.is_admin,
          twoFactorEnabled: false
        },
        twoFactor: {
          secret: tfaSecret,
          qrCode: qrCode,
          otpUri: otpUri
        },
        token,
      },
    }, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
    }

    console.error('Erro no registro:', error);
    return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
  }
});

// Rota de reset de senha
authRoutes.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = resetPasswordSchema.parse(body);

    const pool = getDbPool(c);

    // Buscar usuário
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND secret_phrase = $2',
      [validatedData.email, validatedData.secretPhrase]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado ou frase secreta incorreta' }, 404);
    }

    const userId = result.rows[0].id;

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(validatedData.newPassword, 10);

    // Atualizar senha
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, userId]
    );

    return c.json({ success: true, message: 'Senha redefinida com sucesso' });
  } catch (error: any) {
    console.error('Erro no reset de senha:', error);
    if (error instanceof z.ZodError) {
      return c.json({ success: false, message: error.errors[0].message }, 400);
    }
    return c.json({ success: false, message: 'Erro ao redefinir senha' }, 500);
  }
});

// Rota de verificação de 2FA (Ativação)
authRoutes.post('/verify-2fa', async (c) => {
  try {
    const { email, code } = await c.req.json();
    const pool = getDbPool(c);

    const result = await pool.query(
      'SELECT id, two_factor_secret FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    const { id, two_factor_secret } = result.rows[0];

    const isValid = twoFactorService.verifyToken(code, two_factor_secret);

    if (!isValid) {
      return c.json({ success: false, message: 'Código inválido' }, 400);
    }

    await pool.query(
      'UPDATE users SET two_factor_enabled = TRUE WHERE id = $1',
      [id]
    );

    return c.json({ success: true, message: 'Autenticação de 2 fatores ativada com sucesso!' });
  } catch (error) {
    console.error('Erro na verificação 2FA:', error);
    return c.json({ success: false, message: 'Erro ao verificar código' }, 500);
  }
});

// Rota para obter dados de configuração de 2FA (Para usuários existentes)
authRoutes.get('/2fa/setup', authMiddleware, async (c) => {
  try {
    const userPayload = c.get('user');
    const pool = getDbPool(c);

    // Buscar usuário para verificar se já tem 2FA
    const result = await pool.query(
      'SELECT email, two_factor_enabled, two_factor_secret FROM users WHERE id = $1',
      [userPayload.id]
    );

    if (result.rows.length === 0) {
      return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
    }

    const user = result.rows[0];
    let secret = user.two_factor_secret;

    // Se não tiver segredo ainda, gera um
    if (!secret) {
      secret = twoFactorService.generateSecret();
      await pool.query(
        'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
        [secret, userPayload.id]
      );
    }

    const otpUri = twoFactorService.generateOtpUri(user.email, secret);
    const qrCode = await twoFactorService.generateQrCode(otpUri);

    return c.json({
      success: true,
      data: {
        secret,
        qrCode,
        otpUri,
        enabled: user.two_factor_enabled
      }
    });
  } catch (error) {
    console.error('Erro ao buscar configuração 2FA:', error);
    return c.json({ success: false, message: 'Erro ao gerar dados 2FA' }, 500);
  }
});

// Rota de logout (no backend, apenas invalidar token no frontend)
authRoutes.post('/logout', async (c) => {
  return c.json({
    success: true,
    message: 'Logout realizado com sucesso',
  });
});

export { authRoutes };