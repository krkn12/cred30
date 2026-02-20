import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';

/**
 * Controller para funcionalidades estilo Mercado Livre:
 * - Favoritos (Lista de desejos)
 * - Perguntas e Respostas
 * - Avaliações
 */
export class MarketplaceEnhancementsController {

    // === FAVORITOS ===

    /**
     * Adicionar/Remover item dos favoritos (toggle)
     */
    static async toggleFavorite(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const listingId = c.req.param('id');

            // Verificar se já é favorito
            const existing = await pool.query(
                'SELECT id FROM marketplace_favorites WHERE user_id = $1 AND listing_id = $2',
                [user.id, listingId]
            );

            if (existing.rows.length > 0) {
                // Remover dos favoritos
                await pool.query('DELETE FROM marketplace_favorites WHERE id = $1', [existing.rows[0].id]);
                return c.json({ success: true, favorited: false, message: 'Removido dos favoritos' });
            } else {
                // Adicionar aos favoritos
                await pool.query(
                    'INSERT INTO marketplace_favorites (user_id, listing_id) VALUES ($1, $2)',
                    [user.id, listingId]
                );
                return c.json({ success: true, favorited: true, message: 'Adicionado aos favoritos' });
            }
        } catch (error: unknown) {
            console.error('[FAVORITES] Erro:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Listar meus favoritos
     */
    static async getMyFavorites(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(`
                SELECT l.*, u.name as seller_name, f.created_at as favorited_at
                FROM marketplace_favorites f
                JOIN marketplace_listings l ON f.listing_id = l.id
                JOIN users u ON l.seller_id = u.id
                WHERE f.user_id = $1
                ORDER BY f.created_at DESC
            `, [user.id]);

            return c.json({ success: true, data: result.rows });
        } catch (error: unknown) {
            console.error('[FAVORITES] Erro ao listar:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    // === PERGUNTAS E RESPOSTAS ===

    /**
     * Fazer uma pergunta sobre um anúncio
     */
    static async askQuestion(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const listingId = c.req.param('id');
            const body = await c.req.json();
            const { question } = body;

            if (!question || question.trim().length < 5) {
                return c.json({ success: false, message: 'Pergunta muito curta' }, 400);
            }

            // Verificar se não é o próprio vendedor
            const listing = await pool.query('SELECT seller_id FROM marketplace_listings WHERE id = $1', [listingId]);
            if (listing.rows[0]?.seller_id === user.id) {
                return c.json({ success: false, message: 'Você não pode perguntar no seu próprio anúncio' }, 400);
            }

            const result = await pool.query(
                'INSERT INTO marketplace_questions (listing_id, user_id, question) VALUES ($1, $2, $3) RETURNING *',
                [listingId, user.id, question.trim()]
            );

            return c.json({ success: true, data: result.rows[0], message: 'Pergunta enviada!' });
        } catch (error: unknown) {
            console.error('[QUESTIONS] Erro:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Responder uma pergunta (somente vendedor)
     */
    static async answerQuestion(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const questionId = c.req.param('id');
            const body = await c.req.json();
            const { answer } = body;

            if (!answer || answer.trim().length < 2) {
                return c.json({ success: false, message: 'Resposta muito curta' }, 400);
            }

            // Verificar se é o vendedor do anúncio
            const question = await pool.query(`
                SELECT q.*, l.seller_id 
                FROM marketplace_questions q
                JOIN marketplace_listings l ON q.listing_id = l.id
                WHERE q.id = $1
            `, [questionId]);

            if (question.rows.length === 0) {
                return c.json({ success: false, message: 'Pergunta não encontrada' }, 404);
            }

            if (question.rows[0].seller_id !== user.id) {
                return c.json({ success: false, message: 'Apenas o vendedor pode responder' }, 403);
            }

            await pool.query(
                'UPDATE marketplace_questions SET answer = $1, answered_at = NOW() WHERE id = $2',
                [answer.trim(), questionId]
            );

            return c.json({ success: true, message: 'Resposta enviada!' });
        } catch (error: unknown) {
            console.error('[QUESTIONS] Erro ao responder:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Listar perguntas de um anúncio
     */
    static async getQuestions(c: Context) {
        try {
            const pool = getDbPool(c);
            const listingId = c.req.param('id');

            const result = await pool.query(`
                SELECT q.*, u.name as user_name
                FROM marketplace_questions q
                JOIN users u ON q.user_id = u.id
                WHERE q.listing_id = $1
                ORDER BY q.created_at DESC
            `, [listingId]);

            return c.json({ success: true, data: result.rows });
        } catch (error: unknown) {
            console.error('[QUESTIONS] Erro ao listar:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    // === AVALIAÇÕES ===

    /**
     * Avaliar após pedido concluído
     */
    static async rateUser(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');
            const body = await c.req.json();
            const { rating, comment } = body;

            if (!rating || rating < 1 || rating > 5) {
                return c.json({ success: false, message: 'Avaliação deve ser de 1 a 5 estrelas' }, 400);
            }

            // Buscar pedido
            const order = await pool.query(
                'SELECT * FROM marketplace_orders WHERE id = $1 AND status = $2',
                [orderId, 'COMPLETED']
            );

            if (order.rows.length === 0) {
                return c.json({ success: false, message: 'Pedido não encontrado ou não finalizado' }, 404);
            }

            const orderData = order.rows[0];
            let reviewedUserId: string;
            let reviewType: string;

            // Determinar quem está avaliando quem
            if (orderData.buyer_id === user.id) {
                reviewedUserId = orderData.seller_id;
                reviewType = 'BUYER_TO_SELLER';
            } else if (orderData.seller_id === user.id) {
                reviewedUserId = orderData.buyer_id;
                reviewType = 'SELLER_TO_BUYER';
            } else {
                return c.json({ success: false, message: 'Você não faz parte deste pedido' }, 403);
            }

            // Verificar se já avaliou
            const existing = await pool.query(
                'SELECT id FROM marketplace_reviews WHERE order_id = $1 AND reviewer_id = $2',
                [orderId, user.id]
            );

            if (existing.rows.length > 0) {
                return c.json({ success: false, message: 'Você já avaliou este pedido' }, 400);
            }

            // Inserir avaliação
            await pool.query(
                `INSERT INTO marketplace_reviews (order_id, reviewer_id, reviewed_user_id, rating, comment, review_type)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [orderId, user.id, reviewedUserId, rating, comment || null, reviewType]
            );

            // Atualizar estatísticas do avaliado
            await pool.query(`
                UPDATE users SET
                    seller_total_reviews = seller_total_reviews + 1,
                    seller_rating = (
                        SELECT AVG(rating) FROM marketplace_reviews WHERE reviewed_user_id = $1
                    ),
                    seller_reputation = CASE
                        WHEN seller_total_sales >= 100 AND (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewed_user_id = $1) >= 4.5 THEN 'DIAMANTE'
                        WHEN seller_total_sales >= 50 AND (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewed_user_id = $1) >= 4.0 THEN 'OURO'
                        WHEN seller_total_sales >= 20 AND (SELECT AVG(rating) FROM marketplace_reviews WHERE reviewed_user_id = $1) >= 3.5 THEN 'PRATA'
                        WHEN seller_total_sales >= 5 THEN 'BRONZE'
                        ELSE 'NOVO'
                    END
                WHERE id = $1
            `, [reviewedUserId]);

            return c.json({ success: true, message: 'Avaliação enviada!' });
        } catch (error: unknown) {
            console.error('[REVIEWS] Erro:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Buscar avaliações de um usuário
     */
    static async getUserReviews(c: Context) {
        try {
            const pool = getDbPool(c);
            const userId = c.req.param('userId');

            const result = await pool.query(`
                SELECT r.*, u.name as reviewer_name
                FROM marketplace_reviews r
                JOIN users u ON r.reviewer_id = u.id
                WHERE r.reviewed_user_id = $1
                ORDER BY r.created_at DESC
                LIMIT 50
            `, [userId]);

            // Estatísticas
            const stats = await pool.query(`
                SELECT 
                    COUNT(*) as total_reviews,
                    AVG(rating) as avg_rating,
                    COUNT(*) FILTER (WHERE rating = 5) as five_stars,
                    COUNT(*) FILTER (WHERE rating = 4) as four_stars,
                    COUNT(*) FILTER (WHERE rating = 3) as three_stars,
                    COUNT(*) FILTER (WHERE rating = 2) as two_stars,
                    COUNT(*) FILTER (WHERE rating = 1) as one_star
                FROM marketplace_reviews WHERE reviewed_user_id = $1
            `, [userId]);

            return c.json({
                success: true,
                data: {
                    reviews: result.rows,
                    stats: stats.rows[0]
                }
            });
        } catch (error: unknown) {
            console.error('[REVIEWS] Erro ao listar:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Buscar perfil público do vendedor (Loja)
     */
    static async getSellerProfile(c: Context) {
        try {
            const pool = getDbPool(c);
            const sellerId = c.req.param('id');

            // Dados do Perfil
            const result = await pool.query(`
                SELECT 
                    u.id, u.name, 
                    COALESCE(u.seller_company_name, u.name) as store_name,
                    u.is_verified, u.created_at as member_since,
                    u.seller_rating, u.seller_total_reviews, u.seller_total_sales, u.seller_reputation,
                    u.seller_address_city as city, u.seller_address_state as state,
                    u.avatar_url,
                    (SELECT COUNT(*) FROM marketplace_listings WHERE seller_id = u.id AND status = 'ACTIVE') as active_listings
                FROM users u
                WHERE u.id = $1 AND u.is_seller = true
            `, [sellerId]);

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Vendedor não encontrado' }, 404);
            }

            // Anúncios da Loja
            const listings = await pool.query(`
                SELECT id, title, description, price, category, image_url, stock, is_boosted, created_at
                FROM marketplace_listings
                WHERE seller_id = $1 AND status = 'ACTIVE' AND stock > 0
                ORDER BY is_boosted DESC, created_at DESC
                LIMIT 50
            `, [sellerId]);

            return c.json({
                success: true,
                data: {
                    ...result.rows[0],
                    listings: listings.rows
                }
            });
        } catch (error: unknown) {
            console.error('[SELLER_PROFILE] Erro:', error);
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
