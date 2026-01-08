import { Context } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { updateScore, SCORE_REWARDS } from '../../../application/services/score.service';
import { createTransaction, executeInTransaction } from '../../../domain/services/transaction.service';
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
}
