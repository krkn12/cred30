import { Context } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';
import { createTransaction, executeInTransaction, updateUserBalance } from '../../../domain/services/transaction.service';
import { QUOTA_PRICE, QUOTA_SHARE_VALUE } from '../../../shared/constants/business.constants';

// Schemas
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

const addQuotaSchema = z.object({
    email: z.string().email(),
    quantity: z.number().int().positive(),
    reason: z.string().optional()
});

const addBalanceSchema = z.object({
    email: z.string().email(),
    amount: z.number().positive(),
    reason: z.string().optional()
});

export class AdminUsersController {

    /**
     * Listar todos os usuários com filtros e paginação
     */
    static async listUsers(c: Context) {
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

            // Buscar dados paginados com contagem e valor de cotas
            const dataQuery = `
        SELECT 
            u.id, u.name, u.email, u.role, u.status, u.balance, u.score, u.created_at, u.pix_key, u.membership_type,
            u.referred_by, r.name as referrer_name,
            (SELECT COUNT(*) FROM quotas q WHERE q.user_id = u.id AND (q.status = 'ACTIVE' OR q.status IS NULL)) as quotas_count,
            (SELECT COALESCE(SUM(q.current_value), 0) FROM quotas q WHERE q.user_id = u.id AND (q.status = 'ACTIVE' OR q.status IS NULL)) as quotas_value
        FROM users u
        LEFT JOIN users r ON u.referred_by = r.id
        ${baseQuery.substring(baseQuery.indexOf('WHERE'))}
        ORDER BY u.created_at DESC 
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
    }

    /**
     * Atualizar Role ou Status de um usuário
     */
    static async updateUserAccess(c: Context) {
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
    }

    /**
     * Criar um novo atendente diretamente
     */
    static async createAttendant(c: Context) {
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
    }

    /**
     * Adicionar cotas manualmente para um usuário (Gift/Bonus)
     */
    static async addQuota(c: Context) {
        try {
            const body = await c.req.json();
            const { email, quantity, reason } = addQuotaSchema.parse(body);
            const pool = getDbPool(c);

            // Usar a lógica centralizada de transação
            const result = await executeInTransaction(pool, async (client) => {
                // 1. Encontrar usuário pelo email
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

                await client.query(
                    'UPDATE system_config SET system_balance = system_balance + $1',
                    [giftTotal] // O sistema recebe o valor total (como se o admin estivesse injetando capital)
                );

                // 4. Atualizar Score do Usuário (Benefício da Cota)
                await updateScore(client, user.id, SCORE_REWARDS.QUOTA_PURCHASE * quantity, `Ganhou ${quantity} cotas (Gift Admin)`);

                // 5. Registrar Log no histórico do usuário
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
    }

    /**
     * Adicionar saldo diretamente para um usuário (Depósito Administrativo)
     */
    static async addBalance(c: Context) {
        try {
            const body = await c.req.json();
            const { email, amount, reason } = addBalanceSchema.parse(body);
            const pool = getDbPool(c);
            const adminUser = c.get('user');

            // Usar a lógica centralizada de transação
            const result = await executeInTransaction(pool, async (client) => {
                // 1. Encontrar usuário pelo email
                const userRes = await client.query('SELECT id, name FROM users WHERE email = $1', [email]);
                if (userRes.rows.length === 0) {
                    throw new Error('Usuário não encontrado com este email');
                }
                const user = userRes.rows[0];

                // 2. Atualizar Saldo do Usuário
                await updateUserBalance(client, user.id, amount, 'credit');

                // 3. Registrar Transação
                await createTransaction(
                    client,
                    user.id,
                    'DEPOSIT',
                    amount,
                    `Depósito Administrativo. Motivo: ${reason || 'Ajuste manual'}`,
                    'COMPLETED',
                    { method: 'ADMIN_MANUAL', adminId: adminUser.id, reason }
                );

                // 4. Atualizar Custos Manuais do Sistema (Passivo)
                await client.query(
                    'UPDATE system_config SET total_manual_costs = total_manual_costs + $1',
                    [amount]
                );

                return { user: user.name };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            return c.json({
                success: true,
                message: `R$ ${amount.toFixed(2)} creditados para ${result.data?.user} com sucesso!`
            });

        } catch (error) {
            if (error instanceof z.ZodError) {
                return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            }
            return c.json({ success: false, message: error instanceof Error ? error.message : 'Erro interno' }, 500);
        }
    }
    /**
     * Limpar todos os administradores (Uso restrito/Desenvolvimento)
     */
    static async clearAdmins(c: Context) {
        try {
            const pool = getDbPool(c);
            await pool.query('DELETE FROM users WHERE role = $1', ['ADMIN']);
            return c.json({ success: true, message: 'Administradores removidos com sucesso (Exceto o sistema se houver)' });
        } catch (error: any) {
            console.error('Erro ao limpar admins:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Listar entregadores pendentes de aprovação
     */
    static async listPendingCouriers(c: Context) {
        try {
            const pool = getDbPool(c);
            const status = c.req.query('status') || 'pending';

            const result = await pool.query(`
                SELECT 
                    id, name, email, courier_vehicle, courier_phone, courier_cpf,
                    courier_city, courier_state, courier_status, courier_created_at, score,
                    courier_id_photo, courier_vehicle_photo, courier_doc_photo
                FROM users 
                WHERE is_courier = TRUE AND courier_status = $1
                ORDER BY courier_created_at DESC
            `, [status]);

            return c.json({
                success: true,
                data: result.rows.map(r => ({
                    id: r.id,
                    name: r.name,
                    email: r.email,
                    vehicle: r.courier_vehicle,
                    phone: r.courier_phone,
                    cpf: r.courier_cpf,
                    city: r.courier_city,
                    state: r.courier_state,
                    status: r.courier_status,
                    score: r.score,
                    createdAt: r.courier_created_at,
                    idPhoto: r.courier_id_photo,
                    vehiclePhoto: r.courier_vehicle_photo,
                    docPhoto: r.courier_doc_photo
                }))
            });
        } catch (error: any) {
            console.error('[ADMIN] Erro ao listar entregadores:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Aprovar entregador
     */
    static async approveCourier(c: Context) {
        try {
            const pool = getDbPool(c);
            const { userId } = await c.req.json();

            if (!userId) {
                return c.json({ success: false, message: 'userId é obrigatório' }, 400);
            }

            const result = await pool.query(
                `UPDATE users SET 
                    courier_status = 'approved' 
                 WHERE id = $1 AND is_courier = TRUE AND courier_status = 'pending'
                 RETURNING name`,
                [userId]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Entregador não encontrado ou já processado' }, 404);
            }

            return c.json({
                success: true,
                message: `Entregador ${result.rows[0].name} aprovado com sucesso!`
            });
        } catch (error: any) {
            console.error('[ADMIN] Erro ao aprovar entregador:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Rejeitar entregador
     */
    static async rejectCourier(c: Context) {
        try {
            const pool = getDbPool(c);
            const { userId, reason } = await c.req.json();

            if (!userId) {
                return c.json({ success: false, message: 'userId é obrigatório' }, 400);
            }

            const result = await pool.query(
                `UPDATE users SET 
                    courier_status = 'rejected',
                    is_courier = FALSE
                 WHERE id = $1 AND is_courier = TRUE AND courier_status = 'pending'
                 RETURNING name`,
                [userId]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Entregador não encontrado ou já processado' }, 404);
            }

            return c.json({
                success: true,
                message: `Cadastro de ${result.rows[0].name} rejeitado. Motivo: ${reason || 'Não especificado'}`
            });
        } catch (error: any) {
            console.error('[ADMIN] Erro ao rejeitar entregador:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Listar vendedores por status
     */
    static async listPendingSellers(c: Context) {
        try {
            const pool = getDbPool(c);
            const status = c.req.query('status') || 'pending';

            const result = await pool.query(`
                SELECT 
                    id, name, email, seller_phone as phone, seller_cpf_cnpj as cpf,
                    seller_address_city as city, seller_address_state as state,
                    seller_company_name as company_name, seller_status as status, 
                    seller_created_at as created_at, score
                FROM users 
                WHERE is_seller = TRUE AND seller_status = $1
                ORDER BY seller_created_at DESC
            `, [status]);

            return c.json({
                success: true,
                data: result.rows.map(r => ({
                    id: r.id,
                    name: r.name,
                    email: r.email,
                    phone: r.phone,
                    cpf: r.cpf,
                    city: r.city,
                    state: r.state,
                    companyName: r.company_name,
                    status: r.status,
                    score: r.score,
                    createdAt: r.created_at
                }))
            });
        } catch (error: any) {
            console.error('[ADMIN] Erro ao listar vendedores:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Aprovar vendedor
     */
    static async approveSeller(c: Context) {
        try {
            const pool = getDbPool(c);
            const { userId } = await c.req.json();

            if (!userId) {
                return c.json({ success: false, message: 'userId é obrigatório' }, 400);
            }

            const result = await pool.query(
                `UPDATE users SET 
                    seller_status = 'approved' 
                 WHERE id = $1 AND is_seller = TRUE AND seller_status = 'pending'
                 RETURNING name`,
                [userId]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Vendedor não encontrado ou já processado' }, 404);
            }

            return c.json({
                success: true,
                message: `Vendedor ${result.rows[0].name} aprovado com sucesso!`
            });
        } catch (error: any) {
            console.error('[ADMIN] Erro ao aprovar vendedor:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Rejeitar vendedor
     */
    static async rejectSeller(c: Context) {
        try {
            const pool = getDbPool(c);
            const { userId, reason } = await c.req.json();

            if (!userId) {
                return c.json({ success: false, message: 'userId é obrigatório' }, 400);
            }

            const result = await pool.query(
                `UPDATE users SET 
                    seller_status = 'rejected',
                    is_seller = FALSE
                 WHERE id = $1 AND is_seller = TRUE AND seller_status = 'pending'
                 RETURNING name`,
                [userId]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Vendedor não encontrado ou já processado' }, 404);
            }

            return c.json({
                success: true,
                message: `Cadastro de ${result.rows[0].name} rejeitado. Motivo: ${reason || 'Não especificado'}`
            });
        } catch (error: any) {
            console.error('[ADMIN] Erro ao rejeitar vendedor:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Criar Empréstimo Manual (Ação Admin)
     */
    static async createManualLoan(c: Context) {
        try {
            const body = await c.req.json();
            const { userId, amount, interestRate, installments, description } = body;
            const pool = getDbPool(c);

            if (!userId || !amount || !interestRate || !installments) {
                return c.json({ success: false, message: 'Campos obrigatórios: userId, amount, interestRate, installments' }, 400);
            }

            const result = await executeInTransaction(pool, async (client) => {
                // 1. Verificar Liquidez Real
                const statsRes = await client.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE') as quotas_count,
                        (SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING', 'ACTIVE')) as total_loaned,
                        (SELECT COALESCE(SUM(total_invested), 0) FROM investments WHERE status = 'ACTIVE') as total_invested,
                        (SELECT system_balance FROM system_config LIMIT 1) as system_balance
                `);
                const stats = statsRes.rows[0];
                const realLiquidity = (Number(stats.quotas_count) * QUOTA_SHARE_VALUE) - Number(stats.total_loaned) - Number(stats.total_invested);

                if (amount > realLiquidity) {
                    throw new Error(`Saldo insuficiente na Liquidez Real (R$ ${realLiquidity.toFixed(2)}). Empréstimo não autorizado.`);
                }

                // 2. Buscar Usuário
                const userRes = await client.query('SELECT name FROM users WHERE id = $1', [userId]);
                if (userRes.rows.length === 0) throw new Error('Usuário não encontrado');

                // 3. Criar Empréstimo
                const interestAmount = amount * (interestRate / 100);
                const totalRepayment = amount + interestAmount;
                const installmentAmount = totalRepayment / installments;
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 30); // Primeira parcela em 30 dias

                const loanResult = await client.query(`
                    INSERT INTO loans (user_id, amount, interest_rate, total_repayment, installments, remaining_installments, status, due_date, metadata, created_at)
                    VALUES ($1, $2, $3, $4, $5, $5, 'APPROVED', $6, $7, NOW())
                    RETURNING id
                `, [
                    userId,
                    amount,
                    interestRate / 100,
                    totalRepayment,
                    installments,
                    dueDate,
                    JSON.stringify({
                        origin: 'ADMIN_MANUAL',
                        description: description || 'Empréstimo manual administrativo',
                        interestAmount,
                        installmentAmount
                    })
                ]);

                // 4. Registrar Transação de Saída do Caixa
                await client.query(`
                    INSERT INTO transactions (user_id, type, amount, status, description, metadata, created_at)
                    VALUES ($1, 'LOAN_DISBURSEMENT', $2, 'APPROVED', $3, $4, NOW())
                `, [
                    userId,
                    -amount,
                    `Empréstimo Especial Liberado pelo Admin`,
                    JSON.stringify({ loanId: loanResult.rows[0].id })
                ]);

                // 5. Adicionar saldo ao usuário (para ele sacar ou usar)
                await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, userId]);

                // 6. Deduzir do saldo do sistema (Caixa PIX)
                await client.query('UPDATE system_config SET system_balance = system_balance - $1', [amount]);

                return { loanId: loanResult.rows[0].id, userName: userRes.rows[0].name };
            });

            if (!result.success) {
                return c.json({ success: false, message: result.error }, 400);
            }

            return c.json({
                success: true,
                message: `Empréstimo de R$ ${amount.toFixed(2)} criado com sucesso para ${result.data?.userName}!`,
                data: result.data
            });
        } catch (error: any) {
            console.error('[ADMIN] Erro ao criar empréstimo manual:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
