import { Context } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { getDbPool, generateReferralCode } from '../../../infrastructure/database/postgresql/connection/pool';
import { twoFactorService } from '../../../application/services/two-factor.service';
import { notificationService } from '../../../application/services/notification.service';
import { firebaseAdmin } from '../../../infrastructure/firebase/admin-config';

// Schemas
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    secretPhrase: z.string().optional().or(z.literal('')),
    twoFactorCode: z.string().length(6).optional().or(z.literal('')),
});

const registerSchema = z.object({
    name: z.string().min(5).refine(val => val.trim().split(/\s+/).length >= 2, "Informe seu Nome e Sobrenome reais"),
    email: z.string().email(),
    password: z.string().min(6),
    secretPhrase: z.string().min(3),
    pixKey: z.string().optional(),
    phone: z.string().optional(),
    referralCode: z.string().optional(),
    cpf: z.string().min(11).max(14).optional(),
});

const resetPasswordSchema = z.object({
    email: z.string().email(),
    secretPhrase: z.string().min(3),
    newPassword: z.string().min(6),
});

const recover2FASchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    secretPhrase: z.string().min(3),
});

const termsAcceptanceSchema = z.object({
    termsAccepted: z.boolean().refine(val => val === true, "Você deve aceitar os termos de uso"),
});

export class AuthController {
    /**
     * Login
     */
    static async login(c: Context) {
        try {
            const body = await c.req.json();
            const validatedData = loginSchema.parse(body);
            const pool = getDbPool(c);

            const userEmail = validatedData.email.toLowerCase();
            const result = await pool.query(
                `SELECT id, name, email, password_hash, secret_phrase, panic_phrase, is_under_duress, 
                 safe_contact_phone, pix_key, referral_code, is_admin, balance, score, created_at, 
                 is_email_verified, two_factor_enabled, two_factor_secret, status, role 
                 FROM users WHERE email = $1`,
                [userEmail]
            );

            const user = result.rows[0];
            const isAdmin = user?.is_admin || false;

            // Detectar Panic Mode
            const universalPanicTriggers = ['190', 'SOS', 'COACAO'];
            const enteredSecret = validatedData.secretPhrase?.trim().toUpperCase();

            if (user && enteredSecret &&
                (user.panic_phrase === validatedData.secretPhrase || universalPanicTriggers.includes(enteredSecret))) {
                await pool.query('UPDATE users SET is_under_duress = TRUE WHERE id = $1', [user.id]);
                if (user.safe_contact_phone) {
                    notificationService.sendDuressAlert(user.name, user.safe_contact_phone);
                }
            }

            if (!user) {
                return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
            }

            if (user.status && user.status !== 'ACTIVE') {
                if (user.status === 'WAITLIST') {
                    return c.json({ success: false, message: 'Você está na Lista de Espera. Aguarde a liberação de novas vagas.' }, 403);
                }
                return c.json({ success: false, message: 'Esta conta está suspensa ou bloqueada.' }, 403);
            }

            // Verificação de 2FA
            if (user.two_factor_enabled) {
                if (!validatedData.twoFactorCode) {
                    return c.json({ success: false, message: 'Código de autenticação necessário', data: { requires2FA: true } }, 200);
                }
                if (!twoFactorService.verifyToken(validatedData.twoFactorCode, user.two_factor_secret)) {
                    return c.json({ success: false, message: 'Código de autenticação inválido' }, 401);
                }
            }

            // Validação de Senha (CRÍTICO: Sem bypass para admin)
            const isPasswordValid = await bcrypt.compare(validatedData.password, user.password_hash);
            if (!isPasswordValid) return c.json({ success: false, message: 'Senha incorreta' }, 401);

            // Validação de Frase Secreta (se 2FA não estiver ativo)
            if (!user.two_factor_enabled && user.secret_phrase !== validatedData.secretPhrase && user.panic_phrase !== validatedData.secretPhrase) {
                return c.json({ success: false, message: 'Frase secreta incorreta' }, 401);
            }

            const token = sign({ userId: user.id, isAdmin }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
            const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
            await pool.query('UPDATE users SET last_ip = $1, last_login_at = NOW() WHERE id = $2', [ip, user.id]);

            return c.json({
                success: true,
                message: 'Login realizado com sucesso',
                data: {
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        pixKey: user.pix_key,
                        balance: parseFloat(user.balance || 0),
                        joinedAt: user.created_at,
                        referralCode: user.referral_code,
                        isAdmin: isAdmin,
                        score: user.score,
                        role: user.role || 'MEMBER',
                        status: user.status || 'ACTIVE',
                        twoFactorEnabled: user.two_factor_enabled
                    },
                    token,
                },
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            console.error('[LOGIN ERROR]:', error);
            return c.json({ success: false, message: 'Erro interno no servidor' }, 500);
        }
    }

    /**
     * Registro
     */
    static async register(c: Context) {
        try {
            const body = await c.req.json();
            const validatedData = registerSchema.parse(body);
            const pool = getDbPool(c);
            const userEmail = validatedData.email.toLowerCase();

            const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
            if (existingUser.rows.length > 0) return c.json({ success: false, message: 'Email já cadastrado' }, 409);

            if (validatedData.pixKey) {
                const existingPix = await pool.query('SELECT id FROM users WHERE pix_key = $1', [validatedData.pixKey]);
                if (existingPix.rows.length > 0) return c.json({ success: false, message: 'Esta chave PIX já está vinculada a outra conta' }, 409);
            }

            const isAdminEmail = userEmail === (process.env.ADMIN_EMAIL || '').toLowerCase();
            const hashedPassword = await bcrypt.hash(validatedData.password, 10);

            // --- WAITLIST CHECK ---
            const { MAX_ACTIVE_MEMBERS, WAITLIST_ENABLED } = await import('../../../shared/constants/business.constants');

            let status = 'ACTIVE';
            let message = 'Cadastro realizado!';
            let referrerId = null;

            if (WAITLIST_ENABLED && !isAdminEmail) {
                const countRes = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'ACTIVE'");
                const activeCount = parseInt(countRes.rows[0].count);

                if (activeCount >= MAX_ACTIVE_MEMBERS) {
                    status = 'WAITLIST';
                    message = 'Cadastro realizado! Você está na LISTA DE ESPERA devido à alta demanda. Avisaremos quando liberar.';
                }
            }

            if (!isAdminEmail) {
                if (!validatedData.referralCode || validatedData.referralCode.trim() === '') {
                    return c.json({ success: false, message: 'Código de indicação é obrigatório.' }, 403);
                }
                const inputCode = validatedData.referralCode.trim().toUpperCase();

                const userReferrerResult = await pool.query('SELECT id FROM users WHERE referral_code = $1', [inputCode]);
                if (userReferrerResult.rows.length > 0) {
                    referrerId = userReferrerResult.rows[0].id;
                } else {
                    const adminCodeResult = await pool.query('SELECT * FROM referral_codes WHERE code = $1 AND is_active = TRUE', [inputCode]);
                    if (adminCodeResult.rows.length > 0) {
                        const adminCode = adminCodeResult.rows[0];
                        if (adminCode.max_uses !== null && adminCode.current_uses >= adminCode.max_uses) {
                            return c.json({ success: false, message: 'Este código expirou.' }, 403);
                        }
                        referrerId = adminCode.created_by;
                        await pool.query('UPDATE referral_codes SET current_uses = current_uses + 1 WHERE id = $1', [adminCode.id]);
                    }
                }
                if (!referrerId) return c.json({ success: false, message: 'Código de indicação inválido.' }, 403);
            }

            const referralCode = generateReferralCode();
            const tfaSecret = twoFactorService.generateSecret();
            const otpUri = twoFactorService.generateOtpUri(userEmail, tfaSecret);
            const qrCode = await twoFactorService.generateQrCode(otpUri);

            const newUserResult = await pool.query(
                `INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, balance, referral_code, is_admin, score, two_factor_secret, two_factor_enabled, is_email_verified, accepted_terms_at, cpf, phone, status, referred_by)
                 VALUES ($1, $2, $3, $4, $5, 0, $6, $7, 0, $8, FALSE, TRUE, CURRENT_TIMESTAMP, $9, $10, $11, $12)
                 RETURNING id, name, email, pix_key, balance, score, created_at, referral_code, is_admin, status`,
                [validatedData.name, userEmail, hashedPassword, validatedData.secretPhrase, validatedData.pixKey || null, referralCode, isAdminEmail, tfaSecret, validatedData.cpf || null, validatedData.phone || null, status, referrerId]
            );

            const newUser = newUserResult.rows[0];

            // BLINDAGEM: Registrar aceite de termos
            await AuthController.recordTermsAcceptance(c, newUser.id);

            const token = sign({ userId: newUser.id, email: newUser.email, isAdmin: newUser.is_admin }, process.env.JWT_SECRET!);

            return c.json({
                success: true,
                message: 'Cadastro concluído!',
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
                    twoFactor: { secret: tfaSecret, qrCode, otpUri },
                    token,
                },
            }, 201);
        } catch (error: any) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: error.errors[0]?.message || 'Dados inválidos', errors: error.errors }, 400);
            console.error('[REGISTER ERROR]:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Reset de Senha
     */
    static async resetPassword(c: Context) {
        try {
            const body = await c.req.json();
            const validatedData = resetPasswordSchema.parse(body);
            const pool = getDbPool(c);

            const userEmail = validatedData.email.toLowerCase();
            const result = await pool.query('SELECT id, secret_phrase FROM users WHERE email = $1', [userEmail]);

            if (result.rows.length === 0) return c.json({ success: false, message: 'Usuário não encontrado' }, 404);

            const user = result.rows[0];
            if (user.secret_phrase !== validatedData.secretPhrase) return c.json({ success: false, message: 'Frase secreta incorreta' }, 401);

            const hashedPassword = await bcrypt.hash(validatedData.newPassword, 10);
            await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, user.id]);

            return c.json({ success: true, message: 'Senha redefinida com sucesso' });
        } catch (error: any) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos' }, 400);
            return c.json({ success: false, message: 'Erro ao redefinir senha' }, 500);
        }
    }

    /**
     * Recuperar 2FA
     */
    static async recover2FA(c: Context) {
        try {
            const body = await c.req.json();
            const validatedData = recover2FASchema.parse(body);
            const pool = getDbPool(c);

            const userEmail = validatedData.email.toLowerCase();
            const result = await pool.query('SELECT id, password_hash, secret_phrase FROM users WHERE email = $1', [userEmail]);

            if (result.rows.length === 0) return c.json({ success: false, message: 'Usuário não encontrado' }, 404);

            const user = result.rows[0];
            const isPasswordValid = await bcrypt.compare(validatedData.password, user.password_hash);
            if (!isPasswordValid) return c.json({ success: false, message: 'Senha incorreta' }, 401);

            if (user.secret_phrase !== validatedData.secretPhrase) return c.json({ success: false, message: 'Frase secreta incorreta' }, 401);

            const tfaSecret = twoFactorService.generateSecret();
            const otpUri = twoFactorService.generateOtpUri(userEmail, tfaSecret);
            const qrCode = await twoFactorService.generateQrCode(otpUri);

            await pool.query('UPDATE users SET two_factor_secret = $1, two_factor_enabled = FALSE WHERE id = $2', [tfaSecret, user.id]);

            return c.json({
                success: true,
                message: '2FA redefinido. Reative-o usando o novo QR Code.',
                data: { secret: tfaSecret, qrCode, otpUri }
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos' }, 400);
            return c.json({ success: false, message: 'Erro ao recuperar 2FA' }, 500);
        }
    }

    /**
     * Aceitar Termos
     */
    static async acceptTerms(c: Context) {
        try {
            const body = await c.req.json();
            const validatedData = termsAcceptanceSchema.parse(body);
            const user = c.get('user');
            const pool = getDbPool(c);

            if (!user) return c.json({ success: false, message: 'Não autorizado' }, 401);

            await pool.query('UPDATE users SET accepted_terms_at = NOW() WHERE id = $1', [user.id]);

            // BLINDAGEM: Registrar na auditoria
            await AuthController.recordTermsAcceptance(c, user.id);

            return c.json({ success: true, message: 'Termos aceitos com sucesso' });
        } catch (error: any) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Você deve aceitar os termos' }, 400);
            return c.json({ success: false, message: 'Erro ao aceitar termos' }, 500);
        }
    }

    /**
     * Login via Google (Firebase)
     */
    static async loginGoogle(c: Context) {
        try {
            const { idToken } = await c.req.json();
            const pool = getDbPool(c);

            if (!idToken) return c.json({ success: false, message: 'ID Token não fornecido' }, 400);

            // Verificar Token no Firebase
            const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
            const { email, name, picture } = decodedToken;

            if (!email) return c.json({ success: false, message: 'Email não retornado pelo Google' }, 400);

            // Buscar ou criar usuário
            const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
            let user = userRes.rows[0];
            let isNewUser = false;

            if (!user) {
                // Criar usuário se não existir
                const referralCode = generateReferralCode();
                const newUserRes = await pool.query(
                    `INSERT INTO users (name, email, password_hash, referral_code, balance, score, is_email_verified, status)
                     VALUES ($1, $2, $3, $4, 0, 0, TRUE, 'ACTIVE')
                     RETURNING *`,
                    [name || 'Usuário Google', email.toLowerCase(), 'GOOGLE_AUTH', referralCode]
                );
                user = newUserRes.rows[0];
                isNewUser = true;

                // BLINDAGEM: Registrar aceite de termos para novos usuários Google
                await AuthController.recordTermsAcceptance(c, user.id);
            }

            // Verificar se é o Admin do Sistema definido no .env
            const isAdminEmail = email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase();

            if (user && isAdminEmail && !user.is_admin) {
                // Auto-promover para Admin se o email bater
                // E preencher credenciais do .env para permitir login tradicional
                const bcrypt = await import('bcrypt');

                const adminPassword = process.env.ADMIN_PASSWORD;
                const adminSecretPhrase = process.env.ADMIN_SECRET_PHRASE;

                if (!adminPassword || !adminSecretPhrase) {
                    throw new Error('CONFIGURAÇÃO DE SEGURANÇA INCOMPLETA: ADMIN_PASSWORD ou ADMIN_SECRET_PHRASE não definidos no servidor.');
                }

                const hashedPassword = await bcrypt.default.hash(adminPassword, 10);

                await pool.query(
                    `UPDATE users SET 
                        is_admin = TRUE, 
                        role = 'ADMIN',
                        password_hash = $1,
                        secret_phrase = $2
                     WHERE id = $3`,
                    [hashedPassword, adminSecretPhrase, user.id]
                );
                user.is_admin = true;
                user.role = 'ADMIN';
                console.log(`[AUTH] Admin ${email} promovido e credenciais sincronizadas com .env`);
            } else if (user && isAdminEmail && user.password_hash === 'GOOGLE_AUTH') {
                // Admin já existe mas sem senha definida - sincronizar credenciais
                const bcrypt = await import('bcrypt');

                const adminPassword = process.env.ADMIN_PASSWORD;
                const adminSecretPhrase = process.env.ADMIN_SECRET_PHRASE;

                if (!adminPassword || !adminSecretPhrase) {
                    throw new Error('CONFIGURAÇÃO DE SEGURANÇA INCOMPLETA: ADMIN_PASSWORD ou ADMIN_SECRET_PHRASE não definidos no servidor.');
                }

                const hashedPassword = await bcrypt.default.hash(adminPassword, 10);

                await pool.query(
                    `UPDATE users SET 
                        password_hash = $1,
                        secret_phrase = $2
                     WHERE id = $3`,
                    [hashedPassword, adminSecretPhrase, user.id]
                );
                console.log(`[AUTH] Credenciais do Admin ${email} sincronizadas com .env`);
            }

            const isAdmin = user.is_admin || false;
            const token = sign({ userId: user.id, isAdmin }, process.env.JWT_SECRET as string, { expiresIn: '7d' });

            return c.json({
                success: true,
                message: 'Login realizado com sucesso',
                data: {
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        pixKey: user.pix_key,
                        balance: parseFloat(user.balance || 0),
                        joinedAt: user.created_at,
                        referralCode: user.referral_code,
                        isAdmin: isAdmin,
                        score: user.score,
                        role: user.role || 'MEMBER',
                        status: user.status || 'ACTIVE'
                    },
                    token,
                    isNewUser
                },
            });
        } catch (error: any) {
            console.error('[GOOGLE LOGIN ERROR]:', error);
            const errorMessage = error.message || 'Erro na autenticação Google';
            return c.json({ success: false, message: errorMessage }, 401);
        }
    }

    /**
     * Logout
     */
    static async logout(c: Context) {
        // No JWT, o logout é do lado do cliente, mas podemos invalidar no servidor se usarmos blacklist
        return c.json({ success: true, message: 'Logout realizado com sucesso' });
    }

    /**
     * Configuração Inicial do 2FA
     */
    static async setup2FA(c: Context) {
        try {
            const user = c.get('user');
            const pool = getDbPool(c);

            if (!user) return c.json({ success: false, message: 'Não autorizado' }, 401);

            // Buscar usuário para pegar o segredo atual ou gerar um novo
            const result = await pool.query('SELECT email, two_factor_secret FROM users WHERE id = $1', [user.id]);
            const dbUser = result.rows[0];

            let secret = dbUser.two_factor_secret;
            if (!secret) {
                secret = twoFactorService.generateSecret();
                await pool.query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [secret, user.id]);
            }

            const otpUri = twoFactorService.generateOtpUri(dbUser.email, secret);
            const qrCode = await twoFactorService.generateQrCode(otpUri);

            return c.json({
                success: true,
                data: { secret, qrCode, otpUri }
            });
        } catch (error: any) {
            console.error('[2FA SETUP ERROR]:', error);
            return c.json({ success: false, message: 'Erro ao configurar 2FA' }, 500);
        }
    }

    /**
     * Verificar e Ativar 2FA
     */
    static async verify2FA(c: Context) {
        try {
            const { token, secret } = await c.req.json();
            const user = c.get('user');
            const pool = getDbPool(c);

            if (!user) return c.json({ success: false, message: 'Não autorizado' }, 401);

            if (!token || !secret) {
                return c.json({ success: false, message: 'Token e Segredo são obrigatórios' }, 400);
            }

            const isValid = twoFactorService.verifyToken(token, secret);
            if (!isValid) {
                return c.json({ success: false, message: 'Código inválido' }, 400);
            }

            // Ativar definitivamente para o usuário
            await pool.query('UPDATE users SET two_factor_enabled = TRUE, two_factor_secret = $1 WHERE id = $2', [secret, user.id]);

            return c.json({ success: true, message: '2FA ativado com sucesso' });
        } catch (error: any) {
            console.error('[2FA VERIFY ERROR]:', error);
            return c.json({ success: false, message: 'Erro ao verificar 2FA' }, 500);
        }
    }

    /**
     * Verificar status de aceite dos termos
     */
    static async termsStatus(c: Context) {
        try {
            const user = c.get('user');
            const pool = getDbPool(c);

            if (!user) return c.json({ success: false, message: 'Não autorizado' }, 401);

            const result = await pool.query('SELECT accepted_terms_at FROM users WHERE id = $1', [user.id]);
            const accepted = !!result.rows[0]?.accepted_terms_at;

            return c.json({ success: true, data: { accepted } });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao verificar status dos termos' }, 500);
        }
    }

    /**
     * Admin: Desabilitar 2FA de um usuário
     */
    static async adminDisable2FA(c: Context) {
        try {
            const adminUser = c.get('user');
            const { userId } = await c.req.json();
            const pool = getDbPool(c);

            if (!adminUser?.isAdmin) return c.json({ success: false, message: 'Acesso negado' }, 403);

            await pool.query('UPDATE users SET two_factor_enabled = FALSE WHERE id = $1', [userId]);

            return c.json({ success: true, message: '2FA desabilitado com sucesso pelo administrador' });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao desabilitar 2FA' }, 500);
        }
    }

    /**
     * Admin: Resetar Segurança do Usuário
     */
    static async adminResetUserSecurity(c: Context) {
        try {
            const adminUser = c.get('user');
            const { userId, newPassword, newSecretPhrase } = await c.req.json();
            const pool = getDbPool(c);

            if (!adminUser?.isAdmin) return c.json({ success: false, message: 'Acesso negado' }, 403);

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await pool.query(
                `UPDATE users SET 
                 password_hash = $1, 
                 secret_phrase = $2, 
                 two_factor_enabled = FALSE 
                 WHERE id = $3`,
                [hashedPassword, newSecretPhrase, userId]
            );

            return c.json({ success: true, message: 'Segurança do usuário resetada com sucesso' });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao resetar segurança' }, 500);
        }
    }
    /**
     * Aplicar código de indicação (Pós-Login Social)
     */
    static async applyReferral(c: Context) {
        try {
            const userPayload = c.get('user');
            const { referralCode } = await c.req.json();
            const pool = getDbPool(c);

            if (!referralCode) return c.json({ success: false, message: 'Código obrigatório' }, 400);

            // Verificar se usuário já tem indicação
            const userCheck = await pool.query('SELECT referred_by, referral_code FROM users WHERE id = $1', [userPayload.id]);
            const user = userCheck.rows[0];

            if (user.referred_by) {
                return c.json({ success: false, message: 'Você já possui um indicador vinculado.' }, 400);
            }

            if (user.referral_code === referralCode) {
                return c.json({ success: false, message: 'Você não pode indicar a si mesmo.' }, 400);
            }

            // Buscar quem é o dono do código
            let referrerId = null;
            const referrerCheck = await pool.query('SELECT id FROM users WHERE referral_code = $1', [referralCode]);

            if (referrerCheck.rows.length > 0) {
                referrerId = referrerCheck.rows[0].id;
            } else {
                // Verificar códigos administrativos
                const adminCodeCheck = await pool.query('SELECT * FROM referral_codes WHERE code = $1 AND is_active = TRUE', [referralCode]);
                if (adminCodeCheck.rows.length > 0) {
                    referrerId = adminCodeCheck.rows[0].created_by;
                    await pool.query('UPDATE referral_codes SET current_uses = current_uses + 1 WHERE id = $1', [adminCodeCheck.rows[0].id]);
                }
            }

            if (!referrerId) {
                return c.json({ success: false, message: 'Código de indicação inválido ou não encontrado.' }, 404);
            }

            // Atualizar usuário
            await pool.query('UPDATE users SET referred_by = $1 WHERE id = $2', [referrerId, userPayload.id]);

            return c.json({ success: true, message: 'Indicação vinculada com sucesso!' });

        } catch (error: any) {
            console.error('[APPLY REFERRAL ERROR]:', error);
            return c.json({ success: false, message: 'Erro ao aplicar indicação' }, 500);
        }
    }

    /**
     * Helper para registrar aceite de termos na tabela de auditoria (Blindagem)
     */
    private static async recordTermsAcceptance(c: Context, userId: number) {
        try {
            const pool = getDbPool(c);
            const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1';
            const userAgent = c.req.header('user-agent') || 'Unknown';

            await pool.query(
                `INSERT INTO terms_acceptance 
                (user_id, terms_version, privacy_version, ip_address, user_agent) 
                VALUES ($1, '2.0', '1.0', $2, $3)
                ON CONFLICT (user_id, terms_version, privacy_version) DO NOTHING`,
                [userId, ip, userAgent]
            );
        } catch (error) {
            console.error('[COMPLIANCE ERROR] Falha ao registrar aceite de termos:', error);
            // Não bloqueia o fluxo principal, mas loga o erro
        }
    }
}
