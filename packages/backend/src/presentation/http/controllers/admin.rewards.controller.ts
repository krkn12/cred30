import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';
import { POINTS_CONVERSION_RATE } from '../../../application/services/points.service';

export class AdminRewardsController {
    /**
     * Listar todas as recompensas (Admin)
     */
    static async listRewards(c: Context) {
        try {
            const pool = getDbPool(c);
            const res = await pool.query(`
                SELECT c.*, 
                (SELECT COUNT(*) FROM reward_inventory i WHERE i.reward_id = c.id AND i.is_used = FALSE) as stock_count,
                (SELECT COUNT(*) FROM reward_inventory i WHERE i.reward_id = c.id AND i.is_used = TRUE) as used_count
                FROM reward_catalog c
                ORDER BY created_at DESC
            `);

            return c.json({
                success: true,
                data: res.rows
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Criar ou atualizar recompensa
     * REGRA: O ADM insere o preço em REAIS (value), o sistema calcula os PONTOS automaticamente.
     */
    static async saveReward(c: Context) {
        try {
            const pool = getDbPool(c);
            const body = await c.req.json();
            const { id, name, description, type, value, is_active, image_url } = body;

            // Calcula o custo em pontos automaticamente a partir do valor em reais
            // Fórmula: points_cost = value * POINTS_CONVERSION_RATE
            // Ex: R$ 10.00 com taxa de 1000 pts/R$ = 10000 pts
            const points_cost = Math.round(parseFloat(value) * POINTS_CONVERSION_RATE);

            const res = await pool.query(
                `INSERT INTO reward_catalog (id, name, description, points_cost, type, value, is_active, image_url)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    points_cost = EXCLUDED.points_cost,
                    type = EXCLUDED.type,
                    value = EXCLUDED.value,
                    is_active = EXCLUDED.is_active,
                    image_url = EXCLUDED.image_url
                 RETURNING *`,
                [id, name, description, points_cost, type, value, is_active ?? true, image_url]
            );

            return c.json({
                success: true,
                message: 'Recompensa salva com sucesso!',
                data: res.rows[0]
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Adicionar códigos ao estoque
     */
    static async addInventory(c: Context) {
        try {
            const pool = getDbPool(c);
            const body = await c.req.json();
            const { rewardId, codes } = body; // codes pode ser string separada por linha ou array

            if (!rewardId || !codes) {
                return c.json({ success: false, message: 'ID da recompensa e códigos são necessários.' }, 400);
            }

            const codeList = Array.isArray(codes)
                ? codes
                : codes.split('\n').map((s: string) => s.trim()).filter((s: string) => s !== '');

            if (codeList.length === 0) {
                return c.json({ success: false, message: 'Nenhum código válido fornecido.' }, 400);
            }

            // Inserir múltiplos códigos
            for (const code of codeList) {
                await pool.query(
                    'INSERT INTO reward_inventory (reward_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [rewardId, code]
                );
            }

            return c.json({
                success: true,
                message: `${codeList.length} códigos adicionados ao estoque.`
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Ver histórico de resgates
     */
    static async getRedemptions(c: Context) {
        try {
            const pool = getDbPool(c);
            const res = await pool.query(`
                SELECT r.*, u.name as user_name, u.email as user_email
                FROM reward_redemptions r
                JOIN users u ON r.user_id = u.id
                ORDER BY r.created_at DESC
                LIMIT 100
            `);

            return c.json({
                success: true,
                data: res.rows
            });
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
