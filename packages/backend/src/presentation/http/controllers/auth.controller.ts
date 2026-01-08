import { Context } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { getDbPool, generateReferralCode } from '../../../infrastructure/database/postgresql/connection/pool';
import { twoFactorService } from '../../../application/services/two-factor.service';
import { notificationService } from '../../../application/services/notification.service';

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
    termsVersion: z.string().default('2.0'),
    privacyVersion: z.string().default('1.0'),
    acceptedAgeRequirement: z.boolean().default(true),
    acceptedRiskDisclosure: z.boolean().default(true),
    acceptedTerms: z.boolean().default(true),
    acceptedPrivacy: z.boolean().default(true),
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

            const adminEmail = process.env.ADMIN_EMAIL;
            const adminPass = process.env.ADMIN_PASSWORD;
            const adminSecret = process.env.ADMIN_SECRET_PHRASE;

            const isSuperAdminEnv = adminEmail && adminPass && adminSecret &&
                validatedData.email.toLowerCase() === adminEmail.toLowerCase() &&
                validatedData.password === adminPass &&
                validatedData.secretPhrase === adminSecret;

            const userEmail = validatedData.email.toLowerCase();
            const result = await pool.query(
                'SELECT id, name, email, password_hash, secret_phrase, panic_phrase, is_under_duress, safe_contact_phone, pix_key, referral_code, is_admin, balance, score, created_at, is_email_verified, two_factor_enabled, two_factor_secret, status, role FROM users WHERE email = $1',
                [userEmail]
            );

            let user = result.rows[0];
            let isAdmin = user?.is_admin || false;

            const universalPanicTriggers = ['190', 'SOS', 'COACAO'];
            const enteredSecret = validatedData.secretPhrase?.trim().toUpperCase();

            if (user && enteredSecret &&
                (user.panic_phrase === validatedData.secretPhrase || universalPanicTriggers.includes(enteredSecret))) {
                await pool.query('UPDATE users SET is_under_duress = TRUE WHERE id = $1', [user.id]);
                if (user.safe_contact_phone) {
                    notificationService.sendDuressAlert(user.name, user.safe_contact_phone);
                }
            }

            if (isSuperAdminEnv) {
                isAdmin = true;
                if (!user) {
                    const hashedPassword = await bcrypt.hash(adminPass, 10);
                    const insertResult = await pool.query(
                        `INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, referral_code, is_admin, balance, score)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                         RETURNING id, name, email, pix_key, referral_code, is_admin, balance, score, created_at`,
                        ['Super Administrador', adminEmail, hashedPassword, adminSecret, process.env.ADMIN_PIX_KEY || 'Não configurada', 'ADMIN', true, 0, 1000]
                    );
                    user = insertResult.rows[0];
                }
            } else if (!user) {
                return c.json({ success: false, message: 'Usuário não encontrado' }, 404);
            }

            if (user.status && user.status !== 'ACTIVE') {
                return c.json({ success: false, message: 'Esta conta está suspensa ou bloqueada.' }, 403);
            }

            if (!isSuperAdminEnv) {
                if (user.two_factor_enabled) {
                    if (!validatedData.twoFactorCode) {
                        return c.json({ success: false, message: 'Código de autenticação necessário', data: { requires2FA: true } }, 200);
                    }
                    if (!twoFactorService.verifyToken(validatedData.twoFactorCode, user.two_factor_secret)) {
                        return c.json({ success: false, message: 'Código de autenticação inválido' }, 401);
                    }
                }

                const isPasswordValid = user.password_hash ? await bcrypt.compare(validatedData.password, user.password_hash) : validatedData.password === user.password_hash;
                if (!isPasswordValid) return c.json({ success: false, message: 'Senha incorreta' }, 401);

                if (!user.two_factor_enabled && user.secret_phrase !== validatedData.secretPhrase && user.panic_phrase !== validatedData.secretPhrase) {
                    return c.json({ success: false, message: 'Frase secreta incorreta' }, 401);
                }
            }

            const token = sign({ userId: user.id, isAdmin }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
            const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
            pool.query('UPDATE users SET last_ip = $1, last_login_at = NOW() WHERE id = $2', [ip, user.id]);

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
            if (error instanceof z.ZodError) return c.json({ success: false, message: error.errors[0]?.message || 'Dados inválidos', errors: error.errors }, 400);
            return c.json({ success: false, message: 'Erro interno do servidor', debug: error.message }, 500);
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

            if (!isAdminEmail) {
                if (!validatedData.referralCode || validatedData.referralCode.trim() === '') {
                    return c.json({ success: false, message: 'Código de indicação é obrigatório.' }, 403);
                }
                const inputCode = validatedData.referralCode.trim().toUpperCase();
                let referrerId = null;

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
                `INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, balance, referral_code, is_admin, score, two_factor_secret, two_factor_enabled, is_email_verified, accepted_terms_at, cpf, phone)
                 VALUES ($1, $2, $3, $4, $5, 0, $6, $7, 0, $8, FALSE, TRUE, CURRENT_TIMESTAMP, $9, $10)
                 RETURNING id, name, email, pix_key, balance, score, created_at, referral_code, is_admin`,
                [validatedData.name, userEmail, hashedPassword, validatedData.secretPhrase, validatedData.pixKey || null, referralCode, isAdminEmail, tfaSecret, validatedData.cpf || null, validatedData.phone || null]
            );

            const newUser = newUserResult.rows[0];
            const token = sign({ userId: newUser.id, email: newUser.email, isAdmin: newUser.is_admin }, process.env.JWT_SECRET!);

            return c.json({
                success: true,
                message: 'Cadastro iniciado!',
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

            const result = await pool.query('SELECT id FROM users WHERE email = $1 AND secret_phrase = $2', [validatedData.email, validatedData.secretPhrase]);
            if (result.rows.length === 0) return c.json({ success: false, message: 'Usuário não encontrado ou frase incorreta' }, 404);

            const userId = result.rows[0].id;
            const hashedPassword = await bcrypt.hash(validatedData.newPassword, 10);
            const lockDate = new Date();
            lockDate.setHours(lockDate.getHours() + 48);

            await pool.query('UPDATE users SET password_hash = $1, security_lock_until = $2 WHERE id = $3', [hashedPassword, lockDate, userId]);
            return c.json({ success: true, message: 'Senha redefinida com sucesso' });
        } catch (error: any) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: error.errors[0].message }, 400);
            return c.json({ success: false, message: 'Erro ao redefinir senha' }, 500);
        }
    }

    /**
     * Login via Google
     */
    static async loginGoogle(c: Context) {
        try {
            const { idToken } = await c.req.json();
            if (!idToken) return c.json({ success: false, message: 'Token não fornecido' }, 400);

            const { firebaseAdmin } = await import('../../../infrastructure/firebase/admin-config');
            const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
            const email = decodedToken.email?.toLowerCase();
            const name = decodedToken.name || decodedToken.email?.split('@')[0] || 'Usuário Google';

            if (!email) return c.json({ success: false, message: 'Email não encontrado' }, 400);

            const pool = getDbPool(c);
            const result = await pool.query(
                'SELECT id, name, email, pix_key, referral_code, is_admin, balance, score, created_at, two_factor_enabled, status, role FROM users WHERE email = $1',
                [email]
            );

            let user = result.rows[0];
            let isNewUser = false;

            if (!user) {
                isNewUser = true;
                const referralCode = generateReferralCode();
                const randomPass = await bcrypt.hash(Math.random().toString(36), 10);
                const randomSecret = Math.random().toString(36).substring(2, 10).toUpperCase();

                const insertResult = await pool.query(
                    `INSERT INTO users (name, email, password_hash, secret_phrase, pix_key, balance, referral_code, is_admin, score, is_email_verified)
                     VALUES ($1, $2, $3, $4, $5, 0, $6, FALSE, 0, TRUE)
                     RETURNING id, name, email, pix_key, balance, score, created_at, referral_code, is_admin, role, status`,
                    [name, email, randomPass, randomSecret, 'pendente', referralCode]
                );
                user = insertResult.rows[0];
            }

            if (user.status && user.status !== 'ACTIVE') return c.json({ success: false, message: 'Conta suspensa.' }, 403);

            const token = sign({ userId: user.id, isAdmin: user.is_admin || false }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
            const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
            pool.query('UPDATE users SET last_ip = $1, last_login_at = NOW() WHERE id = $2', [ip, user.id]);

            return c.json({
                success: true,
                message: isNewUser ? 'Conta criada via Google!' : 'Login via Google realizado!',
                data: {
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        pixKey: user.pix_key,
                        balance: parseFloat(user.balance || 0),
                        joinedAt: user.created_at,
                        referralCode: user.referral_code,
                        isAdmin: user.is_admin || false,
                        score: user.score,
                        role: user.role || 'MEMBER',
                        status: user.status || 'ACTIVE',
                        twoFactorEnabled: user.two_factor_enabled || false
                    },
                    token,
                    isNewUser
                },
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Verificar e Ativar 2FA
     */
    static async verify2FA(c: Context) {
        try {
            const { token, secret } = await c.req.json();
            const userPayload = c.get('user');

            if (!token || !secret) {
                return c.json({ success: false, message: 'Token e Segredo são obrigatórios' }, 400);
            }

            const isValid = twoFactorService.verifyToken(token, secret);
            if (!isValid) {
                return c.json({ success: false, message: 'Código inválido' }, 401);
            }

            const pool = getDbPool(c);
            await pool.query(
                'UPDATE users SET two_factor_secret = $1, two_factor_enabled = TRUE WHERE id = $2',
                [secret, userPayload.id]
            );

            return c.json({ success: true, message: 'Autenticação em duas etapas ativada com sucesso!' });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao verificar 2FA' }, 500);
        }
    }

    /**
     * Obter dados para configuração de 2FA
     */
    static async setup2FA(c: Context) {
        try {
            const userPayload = c.get('user');
            const pool = getDbPool(c);

            const userRes = await pool.query('SELECT email, two_factor_secret, two_factor_enabled FROM users WHERE id = $1', [userPayload.id]);
            const user = userRes.rows[0];

            if (user.two_factor_enabled) {
                return c.json({ success: false, message: '2FA já está ativado nesta conta.' }, 400);
            }

            const secret = user.two_factor_secret || twoFactorService.generateSecret();
            const otpUri = twoFactorService.generateOtpUri(user.email, secret);
            const qrCode = await twoFactorService.generateQrCode(otpUri);

            return c.json({
                success: true,
                data: { secret, qrCode, otpUri }
            });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao buscar dados de 2FA' }, 500);
        }
    }

    /**
     * Logout
     */
    static async logout(c: Context) {
        return c.json({ success: true, message: 'Sessão encerrada com sucesso' });
    }

    /**
     * Registrar aceite de termos
     */
    static async acceptTerms(c: Context) {
        try {
            const userPayload = c.get('user');
            const body = await c.req.json();
            const data = termsAcceptanceSchema.parse(body);
            const pool = getDbPool(c);

            const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
            const userAgent = c.req.header('user-agent') || 'unknown';

            await pool.query(
                `INSERT INTO terms_acceptance (
                    user_id, terms_version, privacy_version, ip_address, user_agent,
                    accepted_age_requirement, accepted_risk_disclosure, accepted_terms, accepted_privacy
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (user_id, terms_version, privacy_version) DO UPDATE SET accepted_at = NOW()`,
                [
                    userPayload.id, data.termsVersion, data.privacyVersion, ip, userAgent,
                    data.acceptedAgeRequirement, data.acceptedRiskDisclosure, data.acceptedTerms, data.acceptedPrivacy
                ]
            );

            await pool.query('UPDATE users SET accepted_terms_at = NOW() WHERE id = $1', [userPayload.id]);

            return c.json({ success: true, message: 'Termos aceitos com sucesso' });
        } catch (error: any) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            return c.json({ success: false, message: 'Erro ao registrar aceite' }, 500);
        }
    }

    /**
     * Verificar status de aceite de termos
     */
    static async termsStatus(c: Context) {
        try {
            const userPayload = c.get('user');
            const pool = getDbPool(c);

            const currentTermsVersion = '2.0';
            const currentPrivacyVersion = '1.0';

            const result = await pool.query(
                'SELECT id FROM terms_acceptance WHERE user_id = $1 AND terms_version = $2 AND privacy_version = $3',
                [userPayload.id, currentTermsVersion, currentPrivacyVersion]
            );

            return c.json({
                success: true,
                data: {
                    accepted: result.rows.length > 0,
                    currentTermsVersion,
                    currentPrivacyVersion
                }
            });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao verificar status' }, 500);
        }
    }

    /**
     * Recuperação de 2FA (via Frase Secreta)
     */
    static async recover2FA(c: Context) {
        try {
            const body = await c.req.json();
            const data = recover2FASchema.parse(body);
            const pool = getDbPool(c);

            const result = await pool.query(
                'SELECT id, password_hash FROM users WHERE email = $1 AND secret_phrase = $2',
                [data.email.toLowerCase(), data.secretPhrase]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Dados incorretos' }, 401);
            }

            const user = result.rows[0];
            const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);
            if (!isPasswordValid) {
                return c.json({ success: false, message: 'Dados incorretos' }, 401);
            }

            // Desativar 2FA temporariamente para permitir login e Re-configuração
            await pool.query(
                'UPDATE users SET two_factor_enabled = FALSE, security_lock_until = NOW() + interval \'48 hours\' WHERE id = $1',
                [user.id]
            );

            return c.json({
                success: true,
                message: '2FA desativado. Por favor, faça login e configure um novo autenticador. Sua conta está em quarentena de 48h para transferências.'
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos' }, 400);
            return c.json({ success: false, message: 'Erro interno' }, 500);
        }
    }

    /**
     * Admin: Desativar 2FA de um usuário
     */
    static async adminDisable2FA(c: Context) {
        try {
            const userPayload = c.get('user');
            if (!userPayload?.isAdmin) return c.json({ success: false, message: 'Acesso negado' }, 403);

            const { userId } = await c.req.json();
            if (!userId) return c.json({ success: false, message: 'ID obrigatório' }, 400);

            const pool = getDbPool(c);
            await pool.query('UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1', [userId]);

            return c.json({ success: true, message: '2FA desativado pelo administrador.' });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro interno' }, 500);
        }
    }

    /**
     * Admin: Reset de segurança de usuário
     */
    static async adminResetUserSecurity(c: Context) {
        try {
            const userPayload = c.get('user');
            if (!userPayload?.isAdmin) return c.json({ success: false, message: 'Acesso negado' }, 403);

            const { userId, newPassword, newSecretPhrase, disable2FA } = await c.req.json();
            if (!userId) return c.json({ success: false, message: 'ID obrigatório' }, 400);

            const pool = getDbPool(c);
            const updates: string[] = [];
            const params: any[] = [];
            let pIdx = 1;

            const lockDate = new Date();
            lockDate.setHours(lockDate.getHours() + 48);

            updates.push(`security_lock_until = $${pIdx++}`);
            params.push(lockDate);

            if (newPassword) {
                const hashedPassword = await bcrypt.hash(newPassword, 10);
                updates.push(`password_hash = $${pIdx++}`);
                params.push(hashedPassword);
            }

            if (newSecretPhrase) {
                updates.push(`secret_phrase = $${pIdx++}`);
                params.push(newSecretPhrase);
            }

            if (disable2FA) {
                updates.push(`two_factor_enabled = FALSE`);
                updates.push(`two_factor_secret = NULL`);
            }

            params.push(userId);
            const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${pIdx} RETURNING email`;
            const result = await pool.query(query, params);

            if (result.rows.length === 0) return c.json({ success: false, message: 'Usuário não encontrado' }, 404);

            return c.json({
                success: true,
                message: `Segurança atualizada para ${result.rows[0].email}.`,
                lockUntil: lockDate.getTime()
            });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro interno' }, 500);
        }
    }
}
