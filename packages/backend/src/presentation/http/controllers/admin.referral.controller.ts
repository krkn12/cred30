import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';

// Schema
export const createReferralCodeSchema = z.object({
    code: z.string().min(3).max(20).toUpperCase(),
    maxUses: z.number().int().min(1).optional().nullable(),
});

export class AdminReferralController {

    /**
     * Listar todos os códigos
     */
    static async listReferralCodes(c: Context) {
        try {
            const pool = getDbPool(c);
            const result = await pool.query(`
                SELECT rc.*, u.name as creator_name 
                FROM referral_codes rc
                LEFT JOIN users u ON rc.created_by = u.id
                ORDER BY rc.created_at DESC
            `);
            return c.json({ success: true, data: result.rows });
        } catch (error: unknown) {
            console.error('Erro ao listar códigos de indicação:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Criar novo código
     */
    static async createReferralCode(c: Context) {
        try {
            const body = await c.req.json();
            const { code, maxUses } = createReferralCodeSchema.parse(body);
            const user = c.get('user');
            const pool = getDbPool(c);

            const result = await pool.query(
                'INSERT INTO referral_codes (code, created_by, max_uses) VALUES ($1, $2, $3) RETURNING *',
                [code, user.id, maxUses]
            );

            return c.json({
                success: true,
                message: 'Código de indicação criado com sucesso!',
                data: result.rows[0]
            });
        } catch (error: unknown) {
            if (error.code === '23505') {
                return c.json({ success: false, message: 'Este código já existe. Escolha outro.' }, 409);
            }
            if (error instanceof z.ZodError) {
                return c.json({ success: false, message: 'Dados inválidos', errors: error.errors }, 400);
            }
            console.error('Erro ao criar código de indicação:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Ativar/Desativar código
     */
    static async toggleReferralCode(c: Context) {
        try {
            const id = c.req.param('id');
            const pool = getDbPool(c);

            const result = await pool.query(
                'UPDATE referral_codes SET is_active = NOT is_active WHERE id = $1 RETURNING *',
                [id]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Código não encontrado' }, 404);
            }

            return c.json({
                success: true,
                message: `Código ${result.rows[0].is_active ? 'ativado' : 'desativado'} com sucesso!`,
                data: result.rows[0]
            });
        } catch (error: unknown) {
            console.error('Erro ao toggle código de indicação:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }

    /**
     * Remover código
     */
    static async deleteReferralCode(c: Context) {
        try {
            const id = c.req.param('id');
            const pool = getDbPool(c);
            const result = await pool.query('DELETE FROM referral_codes WHERE id = $1 RETURNING *', [id]);

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Código não encontrado' }, 404);
            }

            return c.json({ success: true, message: 'Código removido com sucesso!' });
        } catch (error: unknown) {
            console.error('Erro ao remover código de indicação:', error);
            return c.json({ success: false, message: 'Erro interno do servidor' }, 500);
        }
    }
}
