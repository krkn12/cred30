import { Context } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { twoFactorService } from '../../../application/services/two-factor.service';
import { UserContext } from '../../../shared/types/hono.types';
import { getWelcomeBenefit, getWelcomeBenefitDescription } from '../../../application/services/welcome-benefit.service';
import { WELCOME_BENEFIT_MAX_USES } from '../../../shared/constants/business.constants';

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
    password: z.string().min(1).optional(),
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
                return c.json({ success: false, message: 'Este CPF já está vinculado a outra conta' }, 409);
            }

            // Verificar se PIX já está em uso
            const existingPix = await pool.query(
                'SELECT id FROM users WHERE pix_key = $1 AND id != $2',
                [data.pixKey, user.id]
            );

            if (existingPix.rows.length > 0) {
                return c.json({ success: false, message: 'Esta chave PIX já está vinculada a outra conta' }, 409);
            }

            await pool.query(
                'UPDATE users SET cpf = $1, pix_key = $2, phone = $3, is_verified = TRUE WHERE id = $4',
                [data.cpf, data.pixKey, data.phone, user.id]
            );

            console.log(`[PROFILE] Usuário ${user.id} completou perfil (CPF, PIX, Tel)`);

            return c.json({
                success: true,
                message: 'Perfil verificado com sucesso! Agora você pode realizar operações financeiras.'
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

            if (isSensitiveChange) {
                const securityRes = await pool.query('SELECT password_hash, two_factor_enabled, two_factor_secret FROM users WHERE id = $1', [user.id]);
                const securityData = securityRes.rows[0];

                if (securityData.two_factor_enabled) {
                    if (!validatedData.confirmationCode) return c.json({ success: false, message: 'Código de autenticação necessário para alterar dados sensíveis.' }, 403);
                    if (!twoFactorService.verifyToken(validatedData.confirmationCode, securityData.two_factor_secret)) return c.json({ success: false, message: 'Código inválido.' }, 401);
                } else {
                    if (!validatedData.password) return c.json({ success: false, message: 'Senha necessária para alterar dados sensíveis.' }, 403);
                    if (!await bcrypt.compare(validatedData.password, securityData.password_hash)) return c.json({ success: false, message: 'Senha incorreta.' }, 401);
                }
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
            const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${pIdx} RETURNING id, name, email, pix_key, balance, score, created_at, referral_code, is_admin, video_points`;
            const result = await pool.query(query, updateValues);

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

            const result = await pool.query(`
                WITH user_stats AS (
                    SELECT u.balance, u.score, u.membership_type, u.is_verified, u.is_seller, u.security_lock_until, u.video_points, COALESCE(u.ad_points, 0) as ad_points, u.phone, u.cpf, u.pix_key, u.address, u.referred_by, COALESCE(u.total_dividends_earned, 0) as total_dividends_earned, u.last_login_at,
                    (SELECT COUNT(*) FROM quotas WHERE user_id = u.id AND status = 'ACTIVE') as quota_count,
                    (SELECT COALESCE(SUM(total_repayment), 0) FROM loans WHERE user_id = u.id AND status IN ('APPROVED', 'PAYMENT_PENDING')) as debt_total
                    FROM users u WHERE u.id = $1
                ),
                recent_tx AS (
                    SELECT json_agg(t) FROM (SELECT id, type, amount, created_at as date, description, status, metadata FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20) t
                ),
                active_quotas AS (
                    SELECT json_agg(q) FROM (SELECT id, user_id as "userId", purchase_price as "purchasePrice", current_value as "currentValue", purchase_date as "purchaseDate", status, yield_rate as "yieldRate" FROM quotas WHERE user_id = $1 ORDER BY purchase_date DESC) q
                ),
                active_loans AS (
                    SELECT json_agg(l) FROM (
                        SELECT ln.id, ln.user_id as "userId", ln.amount::float as amount, ln.total_repayment::float as "totalRepayment", ln.installments, ln.interest_rate::float as "interestRate", ln.status, ln.created_at as "createdAt", ln.due_date as "dueDate",
                        COALESCE((SELECT SUM(li.amount::float) FROM loan_installments li WHERE li.loan_id = ln.id), 0) as "totalPaid",
                        ln.total_repayment::float - COALESCE((SELECT SUM(li.amount::float) FROM loan_installments li WHERE li.loan_id = ln.id), 0) as "remainingAmount",
                        (SELECT COUNT(*) FROM loan_installments li WHERE li.loan_id = ln.id)::int as "paidInstallmentsCount",
                        CASE WHEN COALESCE((SELECT SUM(li.amount::float) FROM loan_installments li WHERE li.loan_id = ln.id), 0) >= ln.total_repayment::float THEN true ELSE false END as "isFullyPaid"
                        FROM loans ln WHERE ln.user_id = $1 ORDER BY ln.created_at DESC
                    ) l
                )
                SELECT (SELECT row_to_json(us) FROM user_stats us) as user_stats, (SELECT * FROM recent_tx) as transactions, (SELECT * FROM active_quotas) as quotas, (SELECT * FROM active_loans) as loans
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
                        video_points: stats.video_points || 0,
                        ad_points: parseInt(stats.ad_points || '0'),
                        phone: stats.phone || null,
                        cpf: stats.cpf || null,
                        pixKey: stats.pix_key || null,
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
            return c.json({ success: false, message: 'Erro ao sincronizar' }, 500);
        }
    }

    /**
     * Alterar Senha
     */
    static async changePassword(c: Context) {
        try {
            const { oldPassword, newPassword } = await c.req.json();
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
            if (result.rows.length === 0) return c.json({ success: false, message: 'Usuário não encontrado' }, 404);

            if (!await bcrypt.compare(oldPassword, result.rows[0].password_hash)) {
                return c.json({ success: false, message: 'Senha atual incorreta' }, 401);
            }

            const hashed = await bcrypt.hash(newPassword, 10);
            await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, user.id]);

            return c.json({ success: true, message: 'Senha alterada com sucesso' });
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

            await pool.query('UPDATE users SET pix_key = $1 WHERE id = $2', [pixKey, user.id]);
            return c.json({ success: true, message: 'Chave PIX atualizada com sucesso!' });
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
                message = `Parabéns! Você ganhou +${scoreReward} pontos de Score!`;
            }

            await pool.query(`INSERT INTO transactions (user_id, type, amount, status, description, metadata) VALUES ($1, 'AD_REWARD', 0, 'APPROVED', $2, $3)`, [user.id, `Visualização de anúncio`, JSON.stringify({ scoreRewarded: scoreReward })]);

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
            console.error('Erro ao excluir conta:', error);
            return c.json({ success: false, message: 'Erro ao processar exclusão' }, 500);
        }
    }
}
