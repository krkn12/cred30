import { Context } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import {
    executeInTransaction,
    updateUserBalance,
    createTransaction,
    processTransactionApproval
} from '../../../domain/services/transaction.service';
import {
    WITHDRAWAL_FIXED_FEE,
    PRIORITY_WITHDRAWAL_FEE,
    MIN_WITHDRAWAL_AMOUNT
} from '../../../shared/constants/business.constants';
import { twoFactorService } from '../../../application/services/two-factor.service';
import { notificationService } from '../../../application/services/notification.service';

import { UserContext } from '../../../shared/types/hono.types';

// Esquemas de validação
const withdrawalSchema = z.object({
    amount: z.number().positive(),
    pixKey: z.string().min(5),
});

const confirmWithdrawalSchema = z.object({
    transactionId: z.number(),
    code: z.string().length(6),
    password: z.string().min(6),
    twoFactorCode: z.string().length(6).optional(), // Código 2FA opcional
});

export class WithdrawalsController {
    /**
     * Solicitar saque
     */
    static async requestWithdrawal(c: Context) {
        try {
            const body = await c.req.json();
            const { amount, pixKey } = withdrawalSchema.parse(body);

            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            // 0. Verificação de valor mínimo
            if (amount < MIN_WITHDRAWAL_AMOUNT) {
                return c.json({
                    success: false,
                    message: `O valor mínimo para saque é de R$ ${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}.`,
                    errorCode: 'MIN_AMOUNT_NOT_MET'
                }, 400);
            }

            // 1. Verificação de Titularidade (CPF Match)
            const userFullDataRes = await pool.query('SELECT cpf, name, last_deposit_at, role, security_lock_until FROM users WHERE id = $1', [user.id]);
            const userFullData = userFullDataRes.rows[0];

            // --- ADMIN BYPASS ---
            // Se o usuário tiver role ADMIN, ignoramos todas as travas de segurança
            const isAdmin = userFullData.role === 'ADMIN' || user.role === 'ADMIN';

            // VERIFICAÇÃO KYC (NOVA)
            const isVerified = userFullDataRes.rows[0]?.is_verified; // Preciso buscar is_verified na query acima ou fazer nova query
            // Vou ajustar a query na linha 56 para trazer is_verified também.

            // Mas espera, não posso editar a query aqui pois o tool 'replace_file_content' é local.
            // Farei a query separada ou ajustarei o bloco anterior se possível.
            // O bloco anterior está na linha 56. Vou editar o bloco da linha 56 até 60 para incluir is_verified.


            if (!userFullData.cpf && !isAdmin) {
                return c.json({
                    success: false,
                    message: 'Você precisa cadastrar seu CPF no perfil antes de realizar saques para sua segurança.',
                    errorCode: 'CPF_REQUIRED'
                }, 400);
            }

            // Normalizar CPF (remover pontos e traços)
            const normalizedUserCpf = userFullData.cpf.replace(/\D/g, '');
            const normalizedPixKey = pixKey.replace(/\D/g, '');

            // Se a chave PIX tiver 11 dígitos, tratamos como CPF
            if (normalizedPixKey.length === 11 && normalizedPixKey !== normalizedUserCpf && !isAdmin) {
                return c.json({
                    success: false,
                    message: 'Segurança Cred30: Só é permitido sacar para uma chave PIX vinculada ao SEU próprio CPF cadastrado.',
                    errorCode: 'CPF_MISMATCH'
                }, 403);
            }

            // 2. Verificação de Carência de 72h (Anti-Lavagem)
            if (userFullData.last_deposit_at && !isAdmin) {
                const lastDeposit = new Date(userFullData.last_deposit_at);
                const hoursSinceDeposit = (new Date().getTime() - lastDeposit.getTime()) / (1000 * 60 * 60);

                if (hoursSinceDeposit < 72) {
                    const remainingHours = Math.ceil(72 - hoursSinceDeposit);
                    return c.json({
                        success: false,
                        message: `Segurança Contra Lavagem: Seu último depósito foi recente. Saques serão liberados em ${remainingHours} horas (Carência de 72h).`,
                        errorCode: 'DEPOSIT_VESTING'
                    }, 403);
                }
            }

            // 3. Verificação de Lock de Segurança Manual (Selo Azul, Coação, etc)
            const lockUntil = userFullData.security_lock_until;
            if (lockUntil && new Date(lockUntil) > new Date() && !isAdmin) {
                return c.json({
                    success: false,
                    message: `Sua conta está sob proteção temporária. Saques liberados em: ${new Date(lockUntil).toLocaleString('pt-BR')}`,
                    errorCode: 'SECURITY_LOCK'
                }, 403);
            }

            const quotasResult = await pool.query(
                "SELECT COALESCE(SUM(current_value), 0) as total_quota_value FROM quotas WHERE user_id = $1 AND status = 'ACTIVE'",
                [user.id]
            );
            const totalQuotaValue = parseFloat(quotasResult.rows[0].total_quota_value);

            // NOVA REGRA SIMPLIFICADA DE TAXA:
            // Se valor das cotas >= valor do saque: GRÁTIS
            // Senão: R$ 3,50 de taxa
            let feeAmount = 0;
            let feeReason = '';

            if (totalQuotaValue >= amount) {
                feeAmount = 0;
                feeReason = 'Grátis (cotas cobrem o valor)';
            } else {
                feeAmount = WITHDRAWAL_FIXED_FEE; // R$ 3,50
                feeReason = 'Taxa fixa (sem cotas suficientes)';
            }

            const netAmount = amount - feeAmount;

            const loansResult = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) as total_loan_amount
         FROM loans 
         WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING')`,
                [user.id]
            );

            const withdrawalsResult = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) as total_withdrawn
         FROM transactions 
         WHERE user_id = $1 AND type = 'WITHDRAWAL' AND status = 'APPROVED'`,
                [user.id]
            );

            const totalLoanAmount = parseFloat(loansResult.rows[0].total_loan_amount);
            const totalWithdrawnAmount = parseFloat(withdrawalsResult.rows[0].total_withdrawn);
            const availableCredit = totalLoanAmount - totalWithdrawnAmount;

            const systemConfigRes = await pool.query("SELECT system_balance FROM system_config LIMIT 1");
            const systemBalance = parseFloat(systemConfigRes.rows[0]?.system_balance || '0');

            if (amount > systemBalance) {
                return c.json({
                    success: false,
                    message: 'Não há saldo disponível no momento para este saque. O sistema opera com lastro real.',
                    errorCode: 'INSUFFICIENT_SYSTEM_BALANCE'
                }, 400);
            }

            const now = new Date();
            const currentHour = now.getHours();
            const isNightMode = currentHour >= 20 || currentHour < 6;

            const duressRes = await pool.query('SELECT is_under_duress FROM users WHERE id = $1', [user.id]);
            const isUnderDuress = duressRes.rows[0]?.is_under_duress;

            if (isUnderDuress && amount > 200 && !isAdmin) {
                return c.json({
                    success: false,
                    message: 'Limite de segurança para transferência imediata excedido. Transação agendada para análise.',
                    errorCode: 'DURESS_LIMIT'
                }, 403);
            }

            if (isNightMode && amount > 500 && !isAdmin) {
                return c.json({
                    success: false,
                    message: 'O Modo Noturno (20h às 06h) limita saques imediatos em R$ 500,00 para sua proteção.',
                    errorCode: 'NIGHT_MODE_LIMIT'
                }, 403);
            }

            // 4. Iniciar Transação de Saque Segura
            const result = await executeInTransaction(pool, async (client) => {
                // LOCK DE SEGURANÇA: Verificar e Bloquear saldo do usuário atomicamente
                const lockRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
                if (lockRes.rows.length === 0) throw new Error('Usuário não encontrado');

                const currentBalanceLocked = parseFloat(lockRes.rows[0].balance);

                if (currentBalanceLocked < amount) {
                    throw new Error(`Saldo insuficiente. Disponível: R$ ${currentBalanceLocked.toFixed(2)}`);
                }

                const balanceDebit = await updateUserBalance(client, user.id, amount, 'debit');
                if (!balanceDebit.success) {
                    throw new Error(balanceDebit.error || 'Saldo insuficiente para este saque.');
                }

                const transactionResult = await createTransaction(
                    client,
                    user.id,
                    'WITHDRAWAL',
                    amount,
                    `Solicitação de Saque - R$ ${netAmount.toFixed(2)} (Taxa: R$ ${feeAmount.toFixed(2)} - ${feeReason})`,
                    'PENDING_CONFIRMATION',
                    {
                        pixKey,
                        feeAmount,
                        netAmount,
                        totalLoanAmount,
                        availableCredit,
                        type: 'CREDIT_WITHDRAWAL',
                        balanceDeducted: true,
                        feeReason,
                        hasQuotaCoverage: totalQuotaValue >= amount
                    }
                );

                if (!transactionResult.success) {
                    throw new Error(transactionResult.error);
                }

                // AUDITORIA FINTECH
                try {
                    const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
                    const userAgent = c.req.header('user-agent') || 'Unknown';
                    // Passar client da transação se possível, mas AuditService.logSensitiveAction aceita pool/client
                    await AuditService.logSensitiveAction(client, user.id, AuditActionType.WITHDRAWAL_REQUEST, {
                        amount,
                        feeAmount,
                        netAmount,
                        pixKey,
                        userAgent
                    }, ip);
                } catch (e: any) { console.error('Audit Error', e); }

                return {
                    transactionId: transactionResult.transactionId,
                    amount,
                    feeAmount,
                    netAmount,
                    availableCredit,
                    feeReason,
                    hasQuotaCoverage: totalQuotaValue >= amount
                };
            });

            let successMessage = 'Solicitação criada! Use seu autenticador para confirmar o saque.';
            if (feeAmount === 0) {
                successMessage += ' ✅ Saque GRÁTIS! Suas cotas cobrem o valor.';
            } else {
                successMessage += ` Taxa de R$ ${feeAmount.toFixed(2)} será cobrada (você não tem cotas suficientes).`;
            }

            return c.json({
                success: true,
                message: successMessage,
                data: {
                    transactionId: result.data?.transactionId,
                    amount: result.data?.amount,
                    feeAmount: result.data?.feeAmount,
                    netAmount: result.data?.netAmount,
                    availableCredit: result.data?.availableCredit,
                    pixKey,
                    requiresConfirmation: true,
                    feeReason: result.data?.feeReason,
                    hasQuotaCoverage: result.data?.hasQuotaCoverage
                },
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            }
            console.error('Erro ao solicitar saque:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Confirmar saque
     */
    static async confirmWithdrawal(c: Context) {
        try {
            const body = await c.req.json();
            const { transactionId, code, password, twoFactorCode } = confirmWithdrawalSchema.parse(body);
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(
                `SELECT id, metadata, status FROM transactions 
         WHERE id = $1 AND user_id = $2 AND status = 'PENDING_CONFIRMATION'`,
                [transactionId, user.id]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Solicitação não encontrada ou já confirmada' }, 404);
            }

            const transaction = result.rows[0];

            const userResult = await pool.query(
                'SELECT name, password_hash, secret_phrase, panic_phrase, safe_contact_phone, two_factor_secret, two_factor_enabled, is_under_duress, is_verified, role FROM users WHERE id = $1',
                [user.id]
            );
            const userData = userResult.rows[0];

            const universalPanicTriggers = ['190', 'SOS', 'COACAO'];
            const enteredPhrase = password?.toString().toUpperCase();

            const isPanicTriggered = password && (
                password === userData.panic_phrase ||
                universalPanicTriggers.includes(enteredPhrase)
            );

            if (isPanicTriggered) {
                console.log(`🚨 [STEALTH DURESS] Usuário: ${userData.name}. Ativando falso sucesso.`);

                await pool.query('UPDATE users SET is_under_duress = TRUE WHERE id = $1', [user.id]);
                await pool.query("UPDATE transactions SET status = 'PENDING', description = '(COAÇÃO) ' || description WHERE id = $1", [transactionId]);

                if (userData.safe_contact_phone) {
                    notificationService.sendDuressAlert(userData.name, userData.safe_contact_phone);
                }

                return c.json({
                    success: false,
                    message: 'Erro de conexão com nossos servidores. Tente novamente mais tarde.',
                    errorCode: 'SERVER_CONNECTION_ERROR'
                }, 500);
            }

            const isPasswordValid = await bcrypt.compare(password, userData.password_hash);
            if (!isPasswordValid) return c.json({ success: false, message: 'Senha da conta incorreta' }, 401);

            if (!userData.is_verified) {
                return c.json({ success: false, message: 'Conta não verificada. Complete seu cadastro para realizar resgates.' }, 403);
            }

            // === VERIFICAÇÃO 2FA PARA SAQUES ===
            if (userData.two_factor_enabled && userData.two_factor_secret) {
                // O código pode vir tanto em 'code' (padrão legado) quanto em 'twoFactorCode'
                const tokenToVerify = twoFactorCode || code;

                if (!tokenToVerify) {
                    return c.json({
                        success: false,
                        message: 'Código 2FA obrigatório para saques.',
                        requires2FA: true
                    }, 401);
                }

                const is2FAValid = twoFactorService.verifyToken(tokenToVerify, userData.two_factor_secret);
                if (!is2FAValid) {
                    return c.json({ success: false, message: 'Código 2FA inválido ou expirado.' }, 401);
                }
            }

            if (userData.is_under_duress) {
                await pool.query("UPDATE transactions SET status = 'PENDING' WHERE id = $1", [transactionId]);
                return c.json({
                    success: true,
                    message: 'Saque confirmado e processado automaticamente com sucesso!'
                });
            }

            // 4. Verificação de Primeiro Saque (Análise Manual Obrigatória)
            const withdrawalCountRes = await pool.query(
                "SELECT COUNT(*) FROM transactions WHERE user_id = $1 AND type = 'WITHDRAWAL' AND status = 'APPROVED'",
                [user.id]
            );
            const isFirstWithdrawal = parseInt(withdrawalCountRes.rows[0].count) === 0;

            const isAdmin = userData.role === 'ADMIN' || user.role === 'ADMIN';

            if (isFirstWithdrawal && !isAdmin) {
                console.log(`[ANALYSIS] Primeiro saque detectado para usuário ${user.id}. Encaminhando para análise manual.`);
                await pool.query(
                    "UPDATE transactions SET status = 'PENDING', description = '(PRIMEIRO SAQUE - ANÁLISE MANUAL) ' || description WHERE id = $1",
                    [transactionId]
                );
                return c.json({
                    success: true,
                    message: 'Como este é seu primeiro saque, ele passará por uma rápida análise de segurança manual (até 24h úteis).'
                });
            }

            const approvalResult = await executeInTransaction(pool, async (client) => {
                return await processTransactionApproval(client, transactionId.toString(), 'APPROVE');
            });

            if (!approvalResult.success) {
                throw new Error(approvalResult.error || 'Erro ao processar aprovação automática do saque.');
            }

            const amountRequested = parseFloat(transaction.metadata.amount || 0);
            await notificationService.notifyNewWithdrawal(user.name, amountRequested);

            return c.json({
                success: true,
                message: 'Saque confirmado e processado automaticamente com sucesso!'
            });

        } catch (error) {
            if (error instanceof z.ZodError) return c.json({ success: false, message: 'Dados inválidos' }, 400);
            console.error('Erro ao confirmar saque:', error);
            return c.json({
                success: false,
                message: error instanceof Error ? error.message : 'Erro interno do servidor'
            }, 500);
        }
    }

    /**
     * Listar saques do usuário
     */
    static async listWithdrawals(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(
                `SELECT id, amount, status, description, created_at, metadata
         FROM transactions 
         WHERE user_id = $1 AND type = 'WITHDRAWAL'
         ORDER BY created_at DESC`,
                [user.id]
            );

            const formattedWithdrawals = result.rows.map(withdrawal => ({
                id: withdrawal.id,
                amount: parseFloat(withdrawal.amount),
                status: withdrawal.status,
                description: withdrawal.description,
                requestDate: new Date(withdrawal.created_at).getTime(),
                metadata: withdrawal.metadata
            }));

            return c.json({
                success: true,
                data: {
                    withdrawals: formattedWithdrawals,
                },
            });
        } catch (error) {
            console.error('Erro ao listar saques:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Buscar limite de crédito disponível
     */
    static async getCreditLimit(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const loansResult = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) as total_loan_amount
         FROM loans 
         WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING')`,
                [user.id]
            );

            const withdrawalsResult = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) as total_withdrawn
         FROM transactions 
         WHERE user_id = $1 AND type = 'WITHDRAWAL' AND status = 'APPROVED'`,
                [user.id]
            );

            const totalLoanAmount = parseFloat(loansResult.rows[0].total_loan_amount);
            const totalWithdrawnAmount = parseFloat(withdrawalsResult.rows[0].total_withdrawn);
            const availableCredit = totalLoanAmount - totalWithdrawnAmount;
            const creditUtilizationRate = totalLoanAmount > 0 ? (totalWithdrawnAmount / totalLoanAmount) * 100 : 0;

            return c.json({
                success: true,
                data: {
                    totalLoanAmount,
                    totalWithdrawnAmount,
                    availableCredit,
                    creditUtilizationRate,
                    hasCreditAvailable: availableCredit > 0
                },
            });
        } catch (error) {
            console.error('Erro ao buscar limite de crédito:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }
}
