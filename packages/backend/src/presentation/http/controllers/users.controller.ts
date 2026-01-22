import { Context } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { twoFactorService } from '../../../application/services/two-factor.service';
import { UserContext } from '../../../shared/types/hono.types';
import { getWelcomeBenefit, getWelcomeBenefitDescription } from '../../../application/services/welcome-benefit.service';
import { WELCOME_BENEFIT_MAX_USES } from '../../../shared/constants/business.constants';
import { LiquidationService } from '../../../application/services/liquidation.service';
import { AuditService, AuditActionType } from '../../../application/services/audit.service';
import { PointsService } from '../../../application/services/points.service';

// Schemas
const completeProfileSchema = z.object({
    cpf: z.string().length(11, 'CPF deve ter 11 dígitos'),
    pixKey: z.string().min(5, 'Chave PIX inválida'),
    phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
});

const updateUserSchema = z.object({
    name: z.string().min(3).optional(),
    pixKey: z.string().min(5).optional(),
    secretPhrase: z.string().min(3).optional(),
    panicPhrase: z.string().min(3).optional(),
    safeContactPhone: z.string().min(8).optional(),
    confirmationCode: z.string().optional(),
    password: z.string().optional(),
});

const linkReferrerSchema = z.object({
    referralCode: z.string().min(1, 'Código de indicação é obrigatório'),
});

export class UsersController {

    /**
     * Obter perfil do usuário atual
     */
    static async getProfile(c: Context) {
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
    }

    /**
     * Obter saldo do usuário
     */
    static async getBalance(c: Context) {
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
    }

    /**
     * Completar perfil (CPF, PIX, Telefone)
     */
    static async completeProfile(c: Context) {
        try {
            const body = await c.req.json();
            const data = completeProfileSchema.parse(body);
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            // Verificar se CPF já está em uso
            const existingCpf = await pool.query(
                'SELECT id FROM users WHERE cpf = $1 AND id != $2',
                [data.cpf, user.id]
            );

            if (existingCpf.rows.length > 0) {
                return c.json({ success: false, message: 'Este CPF já está vinculado a outra conta. Entre em contato com o suporte se acredita ser um erro.' }, 409);
            }

            // Verificar se PIX já está em uso
            const existingPix = await pool.query(
                'SELECT id FROM users WHERE pix_key = $1 AND id != $2',
                [data.pixKey, user.id]
            );

            if (existingPix.rows.length > 0) {
                return c.json({ success: false, message: 'Esta chave PIX já está em uso por outro usuário.' }, 409);
            }

            await pool.query(
                'UPDATE users SET cpf = $1, pix_key = $2, phone = $3 WHERE id = $4',
                [data.cpf, data.pixKey, data.phone, user.id]
            );

            // AUDITORIA
            const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
            await AuditService.logSensitiveAction(pool, user.id, AuditActionType.CPF_UPDATE, { cpf: data.cpf, phone: data.phone }, ip);
            await AuditService.logSensitiveAction(pool, user.id, AuditActionType.PIX_KEY_UPDATE, { pixKey: data.pixKey }, ip);

            console.log(`[PROFILE] Usuário ${user.id} completou perfil (CPF, PIX, Tel)`);

            return c.json({
                success: true,
                message: 'Dados de perfil salvos com sucesso! Agora você pode realizar operações financeiras.'
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return c.json({ success: false, message: error.errors[0].message }, 400);
            }
            console.error('Erro ao completar perfil:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Obter extrato de transações
     */
    static async getTransactions(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const limit = parseInt(c.req.query('limit') || '20');
            const offset = parseInt(c.req.query('offset') || '0');

            const result = await pool.query(
                `SELECT id, type, amount, created_at as date, description, status, metadata
         FROM transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
                [user.id, limit, offset]
            );

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
    }

    /**
     * Atualizar Perfil
     */
    static async updateProfile(c: Context) {
        try {
            const body = await c.req.json();
            const validatedData = updateUserSchema.parse(body);
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const isSensitiveChange = validatedData.pixKey || validatedData.secretPhrase || validatedData.panicPhrase || validatedData.safeContactPhone;
            const ip = c.req.header('x-forwarded-for') || '127.0.0.1';

            if (isSensitiveChange) {
                const securityRes = await pool.query('SELECT password_hash, two_factor_enabled, two_factor_secret FROM users WHERE id = $1', [user.id]);
                const securityData = securityRes.rows[0];

                if (securityData.two_factor_enabled) {
                    if (!validatedData.confirmationCode) return c.json({ success: false, message: 'Código de autenticação necessário para alterar dados sensíveis.' }, 403);
                    if (!twoFactorService.verifyToken(validatedData.confirmationCode, securityData.two_factor_secret)) return c.json({ success: false, message: 'Código inválido.' }, 401);
                } else if (securityData.password_hash) {
                    // Usuário tem senha, deve fornecê-la
                    if (!validatedData.password) return c.json({ success: false, message: 'Senha necessária para alterar dados sensíveis.' }, 403);
                    if (!await bcrypt.compare(validatedData.password, securityData.password_hash)) return c.json({ success: false, message: 'Senha incorreta.' }, 401);
                }
                // Se não tem 2FA e não tem password_hash (usuário Google), permitimos a alteração (ou poderíamos exigir que ele crie uma senha primeiro)
            }

            if (validatedData.secretPhrase) {
                const existing = await pool.query('SELECT id FROM users WHERE secret_phrase = $1 AND id != $2', [validatedData.secretPhrase, user.id]);
                if (existing.rows.length > 0) return c.json({ success: false, message: 'Frase secreta já em uso' }, 409);
            }

            const updateFields = [];
            const updateValues = [];
            let pIdx = 1;

            if (validatedData.name) { updateFields.push(`name = $${pIdx++}`); updateValues.push(validatedData.name); }
            if (validatedData.pixKey) { updateFields.push(`pix_key = $${pIdx++}`); updateValues.push(validatedData.pixKey); }
            if (validatedData.secretPhrase) { updateFields.push(`secret_phrase = $${pIdx++}`); updateValues.push(validatedData.secretPhrase); }
            if (validatedData.panicPhrase) { updateFields.push(`panic_phrase = $${pIdx++}`); updateValues.push(validatedData.panicPhrase); }
            if (validatedData.safeContactPhone) { updateFields.push(`safe_contact_phone = $${pIdx++}`); updateValues.push(validatedData.safeContactPhone); }

            if (isSensitiveChange) {
                updateFields.push(`security_lock_until = $${pIdx++}`);
                const lockDate = new Date();
                lockDate.setHours(lockDate.getHours() + 48);
                updateValues.push(lockDate);
            }

            if (updateFields.length === 0) return c.json({ success: false, message: 'Nenhum campo para atualizar' }, 400);

            updateValues.push(user.id);
            const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${pIdx} RETURNING id, name, email, pix_key, balance, score, created_at, referral_code, is_admin, ad_points`;
            const result = await pool.query(query, updateValues);

            // AUDITORIA PARA ALTERAÇÕES SENSÍVEIS
            if (validatedData.pixKey) {
                await AuditService.logSensitiveAction(pool, user.id, AuditActionType.PIX_KEY_UPDATE, { pixKey: validatedData.pixKey }, ip);
            }
            if (validatedData.secretPhrase || validatedData.panicPhrase) {
                await AuditService.logSensitiveAction(pool, user.id, AuditActionType.SECURITY_PHRASE_UPDATE, { hasSecret: !!validatedData.secretPhrase, hasPanic: !!validatedData.panicPhrase }, ip);
            }

            return c.json({ success: true, message: 'Perfil atualizado com sucesso', data: { user: result.rows[0] } });
        } catch (error: any) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            return c.json({ success: false, message: 'Erro interno' }, 500);
        }
    }

    /**
     * Sincronização Consolidada
     */
    static async syncData(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            // A liquidação agora é processada em background ou pelo agendador para evitar timeout no frontend
            LiquidationService.processOverdueInstallments(pool).catch(err => console.error('[SYNC_LIQ_BG_ERROR]:', err));

            const result = await pool.query(`
                WITH user_stats AS (
                    SELECT u.balance, u.score, u.membership_type, u.is_verified, u.is_seller, u.security_lock_until, u.ad_points, u.pending_ad_points, u.phone, u.cpf, u.pix_key, u.address, u.referred_by, COALESCE(u.total_dividends_earned, 0) as total_dividends_earned, u.last_login_at, u.safe_contact_phone, u.is_protected, u.protection_expires_at,
                    (SELECT COUNT(*) FROM quotas WHERE user_id = u.id AND status = 'ACTIVE') as quota_count,
                    (SELECT COALESCE(SUM(total_repayment), 0) FROM loans WHERE user_id = u.id AND status IN ('APPROVED', 'PAYMENT_PENDING')) as debt_total
                    FROM users u WHERE u.id = $1
                ),
                system_stats AS (
                    SELECT mutual_protection_fund FROM system_config LIMIT 1
                ),
                global_protected_count AS (
                    SELECT COUNT(*) as count FROM users WHERE is_protected = TRUE
                ),
                recent_tx AS (
                    SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT id, user_id as "userId", type, amount, created_at as date, description, status, metadata FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20) t
                ),
                active_quotas AS (
                    SELECT COALESCE(json_agg(q), '[]'::json) FROM (SELECT id, user_id as "userId", purchase_price as "purchasePrice", current_value as "currentValue", purchase_date as "purchaseDate", status, yield_rate as "yieldRate" FROM quotas WHERE user_id = $1 ORDER BY purchase_date DESC) q
                ),
                active_loans AS (
                    SELECT COALESCE(json_agg(l), '[]'::json) FROM (
                        SELECT ln.id, ln.user_id as "userId", ln.amount::float as amount, ln.total_repayment::float as "totalRepayment", ln.installments, ln.interest_rate::float as "interestRate", ln.status, ln.created_at as "createdAt", ln.due_date as "dueDate",
                        COALESCE((SELECT SUM(COALESCE(li.amount, li.expected_amount)::float) FROM loan_installments li WHERE li.loan_id = ln.id AND li.status = 'PAID'), 0) as "totalPaid",
                        ln.total_repayment::float - COALESCE((SELECT SUM(COALESCE(li.amount, li.expected_amount)::float) FROM loan_installments li WHERE li.loan_id = ln.id AND li.status = 'PAID'), 0) as "remainingAmount",
                        (SELECT COUNT(*) FROM loan_installments li WHERE li.loan_id = ln.id AND li.status = 'PAID')::int as "paidInstallmentsCount",
                        CASE WHEN COALESCE((SELECT SUM(COALESCE(li.amount, li.expected_amount)::float) FROM loan_installments li WHERE li.loan_id = ln.id AND li.status = 'PAID'), 0) >= ln.total_repayment::float - 0.01 THEN true ELSE false END as "isFullyPaid",
                        COALESCE((
                          SELECT json_agg(json_build_object(
                            'id', li.id,
                            'installmentNumber', li.installment_number,
                            'amount', li.amount::float,
                            'expectedAmount', li.expected_amount::float,
                            'dueDate', li.due_date,
                            'status', li.status,
                            'paidAt', li.paid_at
                          ) ORDER BY li.installment_number ASC NULLS LAST, li.created_at ASC)
                          FROM loan_installments li
                          WHERE li.loan_id = ln.id
                        ), '[]'::json) as "installmentsList"
                        FROM loans ln WHERE ln.user_id = $1 ORDER BY ln.created_at DESC
                    ) l
                )
                SELECT 
                    (SELECT row_to_json(us) FROM user_stats us) as user_stats, 
                    (SELECT row_to_json(ss) FROM system_stats ss) as system_stats,
                    (SELECT count FROM global_protected_count) as protected_users_count,
                    (SELECT * FROM recent_tx) as transactions, 
                    (SELECT * FROM active_quotas) as quotas, 
                    (SELECT * FROM active_loans) as loans
            `, [user.id]);

            const data = result.rows[0];
            const stats = data.user_stats;

            if (!stats) return c.json({ success: false, message: 'Usuário não encontrado' }, 404);

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
                        ad_points: parseInt(stats.ad_points || '0'),
                        pending_ad_points: parseInt(stats.pending_ad_points || '0'),
                        phone: stats.phone || null,
                        cpf: stats.cpf || null,
                        pixKey: stats.pix_key || null,
                        address: stats.address || null,
                        referred_by: stats.referred_by || null,
                        safeContactPhone: stats.safe_contact_phone || null,
                        total_dividends_earned: parseFloat(stats.total_dividends_earned || '0'),
                        last_login_at: stats.last_login_at,
                        is_protected: stats.is_protected || false,
                        protection_expires_at: stats.protection_expires_at || null
                    },
                    system: {
                        mutualProtectionFund: parseFloat(data.system_stats?.mutual_protection_fund || '0'),
                        protectedUsersCount: parseInt(data.protected_users_count || '0')
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
            return c.json({ success: false, message: 'Erro ao sincronizar' }, 500);
        }
    }

    /**
     * Alterar Senha
     * Permite criar senha para usuários Google (sem senha_hash)
     */
    static async changePassword(c: Context) {
        try {
            const { oldPassword, newPassword } = await c.req.json();
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
            if (result.rows.length === 0) return c.json({ success: false, message: 'Usuário não encontrado' }, 404);

            const hasPassword = !!result.rows[0].password_hash;

            // Se usuário tem senha, verificar senha atual
            if (hasPassword) {
                if (!oldPassword) return c.json({ success: false, message: 'Senha atual necessária' }, 400);
                if (!await bcrypt.compare(oldPassword, result.rows[0].password_hash)) {
                    return c.json({ success: false, message: 'Senha atual incorreta' }, 401);
                }
            }
            // Se usuário não tem senha (logou com Google), pode criar uma nova

            if (!newPassword || newPassword.length < 6) {
                return c.json({ success: false, message: 'Nova senha deve ter pelo menos 6 caracteres' }, 400);
            }

            const hashed = await bcrypt.hash(newPassword, 10);
            await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, user.id]);

            return c.json({ success: true, message: hasPassword ? 'Senha alterada com sucesso' : 'Senha criada com sucesso' });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao alterar senha' }, 500);
        }
    }

    /**
     * Atualizar CPF
     */
    static async updateCpf(c: Context) {
        try {
            const { cpf } = await c.req.json();
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const cleanCpf = cpf?.replace(/\D/g, '');
            if (!cleanCpf || cleanCpf.length !== 11) return c.json({ success: false, message: 'CPF inválido.' }, 400);

            const existing = await pool.query('SELECT id FROM users WHERE cpf = $1 AND id != $2', [cleanCpf, user.id]);
            if (existing.rows.length > 0) return c.json({ success: false, message: 'CPF já cadastrado.' }, 409);

            await pool.query('UPDATE users SET cpf = $1 WHERE id = $2', [cleanCpf, user.id]);
            return c.json({ success: true, message: 'CPF atualizado com sucesso!' });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao atualizar CPF' }, 500);
        }
    }

    /**
     * Atualizar Telefone
     */
    static async updatePhone(c: Context) {
        try {
            const { phone } = await c.req.json();
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const cleanPhone = phone?.replace(/\D/g, '');
            if (!cleanPhone || cleanPhone.length < 10) return c.json({ success: false, message: 'Telefone inválido.' }, 400);

            await pool.query('UPDATE users SET phone = $1 WHERE id = $2', [cleanPhone, user.id]);
            return c.json({ success: true, message: 'Telefone atualizado com sucesso!' });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao atualizar telefone' }, 500);
        }
    }

    /**
     * Atualizar Chave PIX
     * Não exige senha/2FA para permitir usuários logados com Google
     */
    static async updatePixKey(c: Context) {
        try {
            const { pixKey } = await c.req.json();
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            if (!pixKey || pixKey.length < 5) return c.json({ success: false, message: 'Chave PIX inválida.' }, 400);

            // Verificar se PIX já está em uso
            const existing = await pool.query('SELECT id FROM users WHERE pix_key = $1 AND id != $2', [pixKey, user.id]);
            if (existing.rows.length > 0) return c.json({ success: false, message: 'Chave PIX já cadastrada em outra conta.' }, 409);

            // Atualiza a chave PIX e aplica bloqueio de 48h para saques
            await pool.query(
                'UPDATE users SET pix_key = $1, security_lock_until = $2 WHERE id = $3',
                [pixKey, new Date(Date.now() + 48 * 60 * 60 * 1000), user.id]
            );

            return c.json({ success: true, message: 'Chave PIX atualizada! Saques bloqueados por 48h.' });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao atualizar chave PIX' }, 500);
        }
    }

    /**
     * Recompensa Ad
     */
    static async rewardAd(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const check = await pool.query(`SELECT count(*) FROM transactions WHERE user_id = $1 AND type = 'AD_REWARD' AND created_at >= $2`, [user.id, today]);
            const adsToday = parseInt(check.rows[0].count);

            let scoreReward = 0;
            let message = 'Obrigado por apoiar o projeto!';

            if (adsToday < 3) {
                scoreReward = 5;
                await pool.query('UPDATE users SET score = score + $1 WHERE id = $2', [scoreReward, user.id]);
                await PointsService.addPoints(pool, user.id, 1, 'Recompensa de Anúncio (Score + Farm)');
                message = `Parabéns! Você ganhou +${scoreReward} pontos de Score e +1 ponto de Farm!`;
            } else {
                // Mesmo após o limite de score, continua ganhando pontos de farm (Top Farm)
                await PointsService.addPoints(pool, user.id, 1, 'Recompensa de Anúncio (Farm Extra)');
                message = 'Obrigado por apoiar o projeto! +1 ponto de Farm creditado.';
            }

            await pool.query(`INSERT INTO transactions (user_id, type, amount, status, description, metadata) VALUES ($1, 'AD_REWARD', $2, 'APPROVED', $3, $4)`, [
                user.id,
                scoreReward > 0 ? scoreReward : 1, // Logar pelo menos 1 pt de farm se score for 0
                scoreReward > 0 ? `Bônus de Anúncio: +${scoreReward} pontos` : `Apoio ao Projeto (Farm)`,
                JSON.stringify({ scoreRewarded: scoreReward })
            ]);

            return c.json({ success: true, message, data: { scoreRewarded: scoreReward, adsToday: adsToday + (scoreReward > 0 ? 1 : 0) } });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao processar ad' }, 500);
        }
    }

    /**
     * Elegibilidade de Título
     */
    static async getTitleEligibility(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const userRes = await pool.query('SELECT title_downloaded FROM users WHERE id = $1', [user.id]);
            if (userRes.rows[0].title_downloaded) return c.json({ success: true, data: { eligible: false, reason: 'Título já emitido e baixado anteriormente.' } });

            const quotaRes = await pool.query("SELECT count(*) FROM quotas WHERE user_id = $1 AND status = 'ACTIVE'", [user.id]);
            const quotaCount = parseInt(quotaRes.rows[0].count);

            const oldestRes = await pool.query("SELECT purchase_date FROM quotas WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY purchase_date ASC LIMIT 1", [user.id]);
            if (oldestRes.rows.length === 0) return c.json({ success: true, data: { eligible: false, reason: 'Você ainda não possui participações ativas.' } });

            const oldest = new Date(oldestRes.rows[0].purchase_date);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const hasOneYear = oldest <= oneYearAgo;
            const hasEnough = quotaCount >= 500;

            if (!hasEnough) return c.json({ success: true, data: { eligible: false, reason: `Necessário 500 participações. Você tem ${quotaCount}.` } });
            if (!hasOneYear) return c.json({ success: true, data: { eligible: false, reason: 'Necessário 1 ano de carência.' } });

            return c.json({ success: true, data: { eligible: true, message: 'Parabéns! Você é elegível ao Título.' } });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao verificar' }, 500);
        }
    }

    /**
     * Download de Título
     */
    static async titleDownload(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const userRes = await pool.query('SELECT title_downloaded, name FROM users WHERE id = $1', [user.id]);
            if (userRes.rows[0].title_downloaded) return c.json({ success: false, message: 'Título já emitido.' }, 403);

            await pool.query('UPDATE users SET title_downloaded = TRUE, title_downloaded_at = NOW() WHERE id = $1', [user.id]);

            return c.json({ success: true, message: 'Título emitido com sucesso.', data: { userName: userRes.rows[0].name, issueDate: new Date().toLocaleDateString('pt-BR') } });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao emitir' }, 500);
        }
    }

    /**
     * Status de Benefício
     */
    static async getWelcomeBenefitStatus(c: Context) {
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
                    } : null
                }
            });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao consultar benefício' }, 500);
        }
    }

    /**
     * Excluir conta
     */
    static async deleteAccount(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            // Verificar se usuário tem cotas ativas ou empréstimos pendentes
            const quotaCheck = await pool.query("SELECT id FROM quotas WHERE user_id = $1 AND status = 'ACTIVE'", [user.id]);
            if (quotaCheck.rows.length > 0) return c.json({ success: false, message: 'Você possui participações ativas. Venda-as antes de excluir a conta.' }, 400);

            const loanCheck = await pool.query("SELECT id FROM loans WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING')", [user.id]);
            if (loanCheck.rows.length > 0) return c.json({ success: false, message: 'Você possui empréstimos pendentes. Quite-os antes de excluir a conta.' }, 400);

            const balance = user.balance || 0;
            if (balance > 0) return c.json({ success: false, message: 'Você ainda possui saldo em conta. Realize o saque antes de excluir.' }, 400);

            // Excluir conta
            await pool.query('DELETE FROM users WHERE id = $1', [user.id]);

            return c.json({ success: true, message: 'Sua conta foi excluída definitivamente.' });
        } catch (error: any) {
            return c.json({ success: false, message: 'Erro ao processar exclusão' }, 500);
        }
    }

    /**
     * Ranking de Farm (Top 3 + Posição do Usuário)
     */
    static async getFarmRanking(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            // Buscar Top 3
            const top3Res = await pool.query(`
                SELECT id, name, COALESCE(total_ad_points, 0) as points 
                FROM users 
                ORDER BY COALESCE(total_ad_points, 0) DESC, name ASC 
                LIMIT 3
            `);

            // Buscar Posição do Usuário
            const rankRes = await pool.query(`
                SELECT COUNT(*) + 1 as rank 
                FROM users 
                WHERE COALESCE(total_ad_points, 0) > (SELECT COALESCE(total_ad_points, 0) FROM users WHERE id = $1)
            `, [user.id]);

            const userPointsRes = await pool.query('SELECT COALESCE(total_ad_points, 0) as points FROM users WHERE id = $1', [user.id]);

            return c.json({
                success: true,
                data: {
                    top3: top3Res.rows.map(u => ({
                        id: u.id,
                        name: u.name,
                        points: parseInt(u.points),
                        isMe: u.id === user.id
                    })),
                    myRank: {
                        position: parseInt(rankRes.rows[0].rank),
                        points: parseInt(userPointsRes.rows[0].points)
                    }
                }
            });
        } catch (error: any) {
            console.error('Erro ao buscar ranking:', error);
        }
    }

    /**
     * Vincular um padrinho (indicação) após o cadastro
     */
    static async linkReferrer(c: Context) {
        try {
            const body = await c.req.json();
            const { referralCode } = linkReferrerSchema.parse(body);
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            // 1. Verificar se o usuário já possui um indicador
            const currentUserRes = await pool.query('SELECT referred_by, referral_code FROM users WHERE id = $1', [user.id]);
            const currentUser = currentUserRes.rows[0];

            if (currentUser.referred_by) {
                return c.json({ success: false, message: 'Você já possui um padrinho vinculado.' }, 400);
            }

            const inputCode = referralCode.trim().toUpperCase();

            // 2. Impedir auto-indicação
            if (inputCode === currentUser.referral_code) {
                return c.json({ success: false, message: 'Você não pode indicar a si mesmo.' }, 400);
            }

            let referrerId = null;

            // 3. Buscar indicador (usuário ou código administrativo)
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
                    // Incrementar uso do código administrativo
                    await pool.query('UPDATE referral_codes SET current_uses = current_uses + 1 WHERE id = $1', [adminCode.id]);
                }
            }

            if (!referrerId) {
                return c.json({ success: false, message: 'Código de indicação inválido.' }, 404);
            }

            // 4. Vincular
            await pool.query('UPDATE users SET referred_by = $1 WHERE id = $2', [referrerId, user.id]);

            console.log(`[REFERRAL] Usuário ${user.id} vinculou padrinho ${referrerId} via linkReferrer`);

            return c.json({ success: true, message: 'Padrinho vinculado com sucesso!' });
        } catch (error) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            console.error('[LINK REFERRER ERROR]:', error);
            return c.json({ success: false, message: 'Erro interno no servidor' }, 500);
        }
    }
}
