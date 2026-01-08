import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction } from '../../../domain/services/transaction.service';
import { getYouTubeFullStats } from '../../../infrastructure/gateways/youtube.service';
import {
    VIDEO_VIEWER_SHARE as VIEWER_SHARE,
    VIDEO_QUOTA_HOLDERS_SHARE as QUOTA_HOLDERS_SHARE,
    VIDEO_SERVICE_FEE_SHARE as SERVICE_FEE_SHARE,
    PLATFORM_FEE_TAX_SHARE,
    PLATFORM_FEE_OPERATIONAL_SHARE,
    PLATFORM_FEE_OWNER_SHARE,
    PLATFORM_FEE_INVESTMENT_SHARE,
    ADMIN_PIX_KEY
} from '../../../shared/constants/business.constants';

// Constantes
const POINTS_PER_REAL = 100;
const MIN_CONVERSION_POINTS = 100;
const VIDEO_TAGS = ['ENTRETENIMENTO', 'MUSICA', 'EDUCACAO', 'GAMES', 'LIFESTYLE', 'TECNOLOGIA', 'NEGOCIOS', 'SAUDE', 'HUMOR', 'OUTROS'] as const;

// Schema de validação
const createVideoSchema = z.object({
    title: z.string().min(5).max(200),
    description: z.string().max(1000).optional(),
    videoUrl: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    platform: z.enum(['YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'KWAI', 'OTHER']).default('YOUTUBE'),
    tag: z.enum(VIDEO_TAGS).default('OUTROS'),
    durationSeconds: z.number().min(60).max(3600).default(60),
    minWatchSeconds: z.number().min(20).max(300).default(20),
    budget: z.number().min(5, 'O orçamento mínimo é R$ 5,00'),
    pricePerView: z.number().min(0.10).default(0.10),
    requireLike: z.boolean().default(false),
    requireComment: z.boolean().default(false),
    requireSubscribe: z.boolean().default(false),
    minScoreRequired: z.number().min(0).max(1000).default(0),
    verifiedOnly: z.boolean().default(false),
    paymentMethod: z.enum(['BALANCE', 'PIX']).default('BALANCE'),
});

export class PromoVideosController {

    /**
     * Listar tags disponíveis
     */
    static async getTags(c: Context) {
        return c.json({ success: true, data: VIDEO_TAGS });
    }

    /**
     * Listar vídeos disponíveis para assistir (Feed)
     */
    static async getFeed(c: Context) {
        try {
            const userPayload = c.get('user');
            const pool = getDbPool(c);
            const tag = c.req.query('tag');

            const result = await pool.query(`
        SELECT pv.*, u.name as promoter_name,
               (SELECT COUNT(*) FROM promo_video_views pvv WHERE pvv.video_id = pv.id AND pvv.completed = TRUE) as completed_views,
               (pv.user_id = $1) as is_owner,
               ROW_NUMBER() OVER (ORDER BY pv.total_views DESC, pv.price_per_view DESC) as ranking
        FROM promo_videos pv
        JOIN users u ON pv.user_id = u.id
        WHERE pv.is_active = TRUE 
          AND pv.status = 'ACTIVE'
          AND pv.budget > pv.spent
          AND NOT EXISTS (
              SELECT 1 FROM promo_video_views pvv 
              WHERE pvv.video_id = pv.id AND pvv.viewer_id = $1
          )
          ${tag ? 'AND pv.tag = $2' : ''}
        ORDER BY pv.price_per_view DESC, pv.total_views DESC, pv.created_at DESC
        LIMIT 50
      `, tag ? [userPayload.id, tag] : [userPayload.id]);

            return c.json({
                success: true,
                data: result.rows.map(v => ({
                    id: v.id,
                    title: v.title,
                    videoUrl: v.video_url,
                    thumbnailUrl: v.thumbnail_url,
                    platform: v.platform,
                    tag: v.tag || 'OUTROS',
                    pricePerView: parseFloat(v.price_per_view),
                    minWatchSeconds: v.min_watch_seconds || 20,
                    viewerEarningPoints: Math.floor(parseFloat(v.price_per_view) * VIEWER_SHARE * POINTS_PER_REAL),
                    promoterName: v.promoter_name,
                    isOwner: v.is_owner,
                    ranking: parseInt(v.ranking),
                    requireLike: v.require_like,
                    requireComment: v.require_comment,
                    requireSubscribe: v.require_subscribe
                }))
            });
        } catch (error) {
            console.error('[PROMO-VIDEOS] Erro ao buscar feed:', error);
            return c.json({ success: false, message: 'Erro ao buscar vídeos' }, 500);
        }
    }

    /**
     * Farm: Buscar próximo vídeo disponível
     */
    static async getNextFarmVideo(c: Context) {
        try {
            const userPayload = c.get('user');
            const pool = getDbPool(c);

            const result = await pool.query(`
        SELECT pv.*, u.name as promoter_name
        FROM promo_videos pv
        JOIN users u ON pv.user_id = u.id
        WHERE pv.is_active = TRUE 
          AND pv.status = 'ACTIVE'
          AND pv.budget > pv.spent
          AND pv.user_id != $1
          AND NOT EXISTS (
              SELECT 1 FROM promo_video_views pvv 
              WHERE pvv.video_id = pv.id AND pvv.viewer_id = $1
          )
        ORDER BY pv.price_per_view DESC, pv.created_at ASC
        LIMIT 1
      `, [userPayload.id]);

            if (result.rows.length === 0) {
                return c.json({
                    success: false,
                    message: 'Você já assistiu todos os vídeos disponíveis! Volte mais tarde.',
                    code: 'NO_VIDEOS_AVAILABLE'
                });
            }

            const v = result.rows[0];
            return c.json({
                success: true,
                data: {
                    id: v.id,
                    title: v.title,
                    videoUrl: v.video_url,
                    thumbnailUrl: v.thumbnail_url,
                    platform: v.platform,
                    tag: v.tag || 'OUTROS',
                    pricePerView: parseFloat(v.price_per_view),
                    minWatchSeconds: v.min_watch_seconds || 20,
                    viewerEarningPoints: Math.floor(parseFloat(v.price_per_view) * VIEWER_SHARE * POINTS_PER_REAL),
                    promoterName: v.promoter_name,
                    requireLike: v.require_like,
                    requireComment: v.require_comment,
                    requireSubscribe: v.require_subscribe
                }
            });
        } catch (error) {
            console.error('[FARM] Erro ao buscar próximo vídeo:', error);
            return c.json({ success: false, message: 'Erro ao processar farm' }, 500);
        }
    }

    /**
     * Minhas campanhas
     */
    static async getMyCampaigns(c: Context) {
        try {
            const userPayload = c.get('user');
            const pool = getDbPool(c);

            const result = await pool.query(`
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY total_views DESC, price_per_view DESC) as global_rank
            FROM promo_videos WHERE is_active = TRUE AND status = 'ACTIVE'
        )
        SELECT pv.*, 
               COALESCE(r.global_rank, 0) as ranking,
               (SELECT COUNT(*) FROM promo_video_views pvv WHERE pvv.video_id = pv.id AND pvv.completed = TRUE) as completed_views
        FROM promo_videos pv
        LEFT JOIN ranked r ON pv.id = r.id
        WHERE pv.user_id = $1 
        ORDER BY pv.created_at DESC
      `, [userPayload.id]);

            return c.json({
                success: true,
                data: result.rows.map(v => ({
                    id: v.id,
                    title: v.title,
                    videoUrl: v.video_url,
                    platform: v.platform,
                    tag: v.tag || 'OUTROS',
                    pricePerView: parseFloat(v.price_per_view),
                    minWatchSeconds: v.min_watch_seconds || 20,
                    budget: parseFloat(v.budget),
                    spent: parseFloat(v.spent),
                    remaining: parseFloat(v.budget) - parseFloat(v.spent),
                    totalViews: parseInt(v.total_views) || 0,
                    completedViews: parseInt(v.completed_views) || 0,
                    targetViews: v.target_views,
                    status: v.status,
                    isActive: v.is_active,
                    ranking: parseInt(v.ranking) || null,
                    createdAt: v.created_at,
                    requireLike: v.require_like,
                    requireComment: v.require_comment,
                    requireSubscribe: v.require_subscribe
                }))
            });
        } catch (error) {
            console.error('[PROMO-VIDEOS] Erro ao buscar campanhas:', error);
            return c.json({ success: false, message: 'Erro ao buscar campanhas' }, 500);
        }
    }

    /**
     * Meus ganhos assistindo vídeos
     */
    static async getMyEarnings(c: Context) {
        try {
            const userPayload = c.get('user');
            const pool = getDbPool(c);

            const result = await pool.query(`
        SELECT 
            COALESCE(SUM(earned), 0) as total_earned,
            (SELECT video_points FROM users WHERE id = $1) as current_points,
            COUNT(*) FILTER (WHERE completed = TRUE) as videos_watched
        FROM promo_video_views
        WHERE viewer_id = $1
      `, [userPayload.id]);

            const { total_earned, current_points, videos_watched } = result.rows[0];

            return c.json({
                success: true,
                data: {
                    totalEarned: parseFloat(total_earned) || 0,
                    currentPoints: parseInt(current_points) || 0,
                    videosWatched: parseInt(videos_watched) || 0,
                    conversionRate: POINTS_PER_REAL,
                    minConversionPoints: MIN_CONVERSION_POINTS
                }
            });
        } catch (error) {
            console.error('[PROMO-VIDEOS] Erro ao buscar ganhos:', error);
            return c.json({ success: false, message: 'Erro ao buscar ganhos' }, 500);
        }
    }

    /**
     * Deletar/Cancelar campanha
     */
    static async deleteCampaign(c: Context) {
        try {
            const userPayload = c.get('user');
            const id = c.req.param('id');
            const pool = getDbPool(c);

            const checkResult = await pool.query(
                'SELECT * FROM promo_videos WHERE id = $1 AND user_id = $2',
                [id, userPayload.id]
            );

            if (checkResult.rows.length === 0) {
                return c.json({ success: false, message: 'Campanha não encontrada.' }, 404);
            }

            const campaign = checkResult.rows[0];

            if (campaign.status === 'PENDING') {
                await pool.query('DELETE FROM promo_videos WHERE id = $1', [id]);
            } else {
                await pool.query(
                    'UPDATE promo_videos SET is_active = FALSE, status = $1 WHERE id = $2',
                    ['CANCELED', id]
                );
            }

            return c.json({
                success: true,
                message: 'Campanha removida com sucesso.'
            });
        } catch (error: any) {
            console.error('[PROMO-VIDEOS] Erro ao remover campanha:', error);
            return c.json({ success: false, message: error.message || 'Erro ao remover campanha' }, 500);
        }
    }

    /**
     * Converter pontos em dinheiro
     */
    static async convertPoints(c: Context) {
        try {
            const userPayload = c.get('user');
            const pool = getDbPool(c);

            const userRes = await pool.query('SELECT video_points, balance FROM users WHERE id = $1', [userPayload.id]);
            const user = userRes.rows[0];

            if (user.video_points < MIN_CONVERSION_POINTS) {
                return c.json({ success: false, message: `Mínimo de ${MIN_CONVERSION_POINTS} pontos para conversão.` }, 400);
            }

            const pointsToConvert = Math.floor(user.video_points);
            const amountToAdd = pointsToConvert / POINTS_PER_REAL;

            await executeInTransaction(pool, async (client) => {
                const systemRes = await client.query('SELECT profit_pool FROM system_config LIMIT 1 FOR UPDATE');
                const profitPool = parseFloat(systemRes.rows[0]?.profit_pool || '0');

                if (profitPool < amountToAdd) {
                    throw new Error('Fundo de pagamentos insuficiente. Tente mais tarde.');
                }

                await client.query('UPDATE system_config SET profit_pool = profit_pool - $1', [amountToAdd]);
                await client.query('UPDATE users SET video_points = video_points - $1 WHERE id = $2', [pointsToConvert, userPayload.id]);
                await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amountToAdd, userPayload.id]);
                await client.query(`
          INSERT INTO transactions (user_id, type, amount, description, status)
          VALUES ($1, 'POINTS_CONVERSION', $2, $3, 'COMPLETED')
        `, [userPayload.id, amountToAdd, `Conversão de ${pointsToConvert} pontos de vídeo`]);
            });

            return c.json({
                success: true,
                message: `Sucesso! R$ ${amountToAdd.toFixed(2)} adicionados ao seu saldo.`,
                data: { convertedAmount: amountToAdd, remainingPoints: 0 }
            });
        } catch (error: any) {
            console.error('[PROMO-VIDEOS] Erro ao converter pontos:', error);
            return c.json({ success: false, message: error.message || 'Erro ao converter pontos' }, 500);
        }
    }

    /**
     * Criar nova campanha
     */
    static async createCampaign(c: Context) {
        try {
            const userPayload = c.get('user');
            const body = await c.req.json();
            const data = createVideoSchema.parse(body);
            const pool = getDbPool(c);

            // Validação de Preço Mínimo com Adicionais
            const minBase = 0.10;
            const missionsPrice = (data.requireLike ? 0.02 : 0) + (data.requireComment ? 0.05 : 0) + (data.requireSubscribe ? 0.08 : 0);
            const expectedMinPrice = minBase + missionsPrice;

            if (data.pricePerView < expectedMinPrice) {
                return c.json({ success: false, message: `Preço por view insuficiente para os adicionais selecionados. Mínimo: R$ ${expectedMinPrice.toFixed(2)}` }, 400);
            }

            const grossPPV = data.pricePerView;
            const targetViews = Math.floor((data.budget / grossPPV) * 1.02); // 2% bonus views
            const viewerPool = data.budget * VIEWER_SHARE;

            // Auditoria Inicial Completa (Likes, Comments, Subs)
            let initialStats = { likes: 0, comments: 0, subscribers: 0 };
            if (data.platform === 'YOUTUBE') {
                const stats = await getYouTubeFullStats(data.videoUrl);
                if (stats) {
                    initialStats = {
                        likes: stats.likes,
                        comments: stats.comments,
                        subscribers: stats.subscribers
                    };
                }
            }

            const userResult = await pool.query('SELECT name, email, cpf, balance FROM users WHERE id = $1', [userPayload.id]);
            const user = userResult.rows[0];

            if (data.paymentMethod === 'BALANCE') {
                const userBalance = parseFloat(user.balance);
                if (userBalance < data.budget) return c.json({ success: false, message: 'Saldo insuficiente.' }, 400);

                await executeInTransaction(pool, async (client) => {
                    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [data.budget, userPayload.id]);

                    const quotaShare = data.budget * QUOTA_HOLDERS_SHARE;
                    const platformShare = data.budget * SERVICE_FEE_SHARE;

                    await client.query(
                        `UPDATE system_config SET 
                            profit_pool = profit_pool + $1, 
                            total_tax_reserve = total_tax_reserve + $2,
                            total_operational_reserve = total_operational_reserve + $3,
                            total_owner_profit = total_owner_profit + $4,
                            investment_reserve = investment_reserve + $5,
                            system_balance = system_balance + $6`,
                        [
                            quotaShare,
                            platformShare * PLATFORM_FEE_TAX_SHARE,
                            platformShare * PLATFORM_FEE_OPERATIONAL_SHARE,
                            platformShare * PLATFORM_FEE_OWNER_SHARE,
                            platformShare * PLATFORM_FEE_INVESTMENT_SHARE,
                            data.budget - quotaShare
                        ]
                    );

                    const videoResult = await client.query(`
                        INSERT INTO promo_videos (
                            user_id, title, description, video_url, thumbnail_url, platform, tag,
                            duration_seconds, price_per_view, min_watch_seconds, budget, budget_gross, spent, 
                            target_views, status, is_active, is_approved,
                            require_like, require_comment, require_subscribe,
                            min_score_required, verified_only,
                            external_initial_likes, external_current_likes,
                            external_initial_comments, external_current_comments,
                            external_initial_subscribers, external_current_subscribers
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $13, 'ACTIVE', TRUE, TRUE, $14, $15, $16, $17, $18, $19, $19, $20, $20, $21, $21)
                        RETURNING id
                    `, [
                        userPayload.id, data.title, data.description || null, data.videoUrl,
                        data.thumbnailUrl || null, data.platform, data.tag || 'OUTROS', data.durationSeconds,
                        grossPPV, data.minWatchSeconds || 20, viewerPool, data.budget, targetViews,
                        data.requireLike, data.requireComment, data.requireSubscribe,
                        data.minScoreRequired, data.verifiedOnly,
                        initialStats.likes, initialStats.comments, initialStats.subscribers
                    ]);

                    await client.query(`
                        INSERT INTO transactions (user_id, type, amount, description, status)
                        VALUES ($1, 'PROMO_VIDEO_BUDGET', $2, $3, 'COMPLETED')
                    `, [userPayload.id, -data.budget, `Campanha: ${data.title} (${targetViews} views)`]);

                    return { videoId: videoResult.rows[0].id };
                });

                return c.json({
                    success: true,
                    message: `Campanha ativa! Alcance: ${targetViews} views.`,
                    data: { targetViews, viewerEarningPoints: Math.floor(grossPPV * VIEWER_SHARE * POINTS_PER_REAL) }
                });
            }

            // PIX Manual
            if (data.paymentMethod === 'PIX') {
                await pool.query(`
                    INSERT INTO promo_videos (
                        user_id, title, description, video_url, thumbnail_url, platform, tag,
                        duration_seconds, price_per_view, min_watch_seconds, budget, budget_gross, spent, target_views, status, is_active,
                        require_like, require_comment, require_subscribe,
                        min_score_required, verified_only,
                        external_initial_likes, external_current_likes,
                        external_initial_comments, external_current_comments,
                        external_initial_subscribers, external_current_subscribers
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $13, 'PENDING', FALSE, $14, $15, $16, $17, $18, $19, $19, $20, $20, $21, $21)
                `, [
                    userPayload.id, data.title, data.description, data.videoUrl, data.thumbnailUrl, data.platform, data.tag || 'OUTROS',
                    data.durationSeconds, grossPPV, data.minWatchSeconds || 20, viewerPool, data.budget, targetViews,
                    data.requireLike, data.requireComment, data.requireSubscribe,
                    data.minScoreRequired, data.verifiedOnly,
                    initialStats.likes, initialStats.comments, initialStats.subscribers
                ]);

                return c.json({
                    success: true,
                    message: 'Campanha criada! Realize a transferência PIX para ativar.',
                    data: {
                        manualPix: {
                            key: ADMIN_PIX_KEY,
                            owner: 'Cred30',
                            amount: data.budget,
                            description: `Transferência para campanha: ${data.title}`
                        },
                        targetViews,
                        viewerEarningPoints: Math.floor(grossPPV * VIEWER_SHARE * POINTS_PER_REAL)
                    }
                });
            }

            return c.json({ success: false, message: 'Opção inválida' }, 400);
        } catch (error: any) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Registrar início de view
     */
    static async startView(c: Context) {
        try {
            const userPayload = c.get('user');
            const videoId = c.req.param('videoId');
            const body = await c.req.json();
            const deviceFingerprint = body.deviceFingerprint || 'unknown';
            const pool = getDbPool(c);

            const videoResult = await pool.query(
                'SELECT * FROM promo_videos WHERE id = $1 AND is_active = TRUE AND status = $2',
                [videoId, 'ACTIVE']
            );

            if (videoResult.rows.length === 0) return c.json({ success: false, message: 'Vídeo não disponível' }, 404);
            const video = videoResult.rows[0];

            // Verificar pré-requisitos
            const userResult = await pool.query('SELECT score, is_verified FROM users WHERE id = $1', [userPayload.id]);
            const user = userResult.rows[0];

            if (video.verified_only && !user.is_verified) {
                return c.json({ success: false, message: 'Esta campanha é exclusiva para Membros Verificados (Selo Azul).' }, 403);
            }

            if (user.score < video.min_score_required) {
                return c.json({ success: false, message: `Seu Score (${user.score}) é insuficiente. Esta campanha exige no mínimo ${video.min_score_required} pontos.` }, 403);
            }

            // Anti-Fazendinha
            const deviceViewCheck = await pool.query(
                'SELECT id FROM promo_video_views WHERE video_id = $1 AND device_fingerprint = $2',
                [videoId, deviceFingerprint]
            );
            if (deviceViewCheck.rows.length > 0) {
                return c.json({ success: false, message: 'Este aparelho já recebeu o bônus por este vídeo hoje.' }, 403);
            }

            const isOwner = Number(video.user_id) === Number(userPayload.id);

            if (isOwner) {
                return c.json({
                    success: true,
                    data: {
                        viewId: null,
                        minWatchSeconds: video.min_watch_seconds,
                        viewerEarning: 0,
                        isOwner: true,
                    }
                });
            }

            const existingView = await pool.query(
                'SELECT id FROM promo_video_views WHERE video_id = $1 AND viewer_id = $2',
                [videoId, userPayload.id]
            );
            if (existingView.rows.length > 0) return c.json({ success: false, message: 'Já assistiu' }, 400);

            if (parseFloat(video.budget) <= parseFloat(video.spent)) return c.json({ success: false, message: 'Esgotado' }, 400);

            const ipAddress = (c.req.header('x-forwarded-for') || '127.0.0.1').split(',')[0].trim();
            const userAgent = c.req.header('user-agent') || 'Unknown';

            const viewResult = await pool.query(`
                INSERT INTO promo_video_views (video_id, viewer_id, ip_address, user_agent, device_fingerprint)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [videoId, userPayload.id, ipAddress, userAgent, deviceFingerprint]);

            return c.json({
                success: true,
                data: {
                    viewId: viewResult.rows[0].id,
                    minWatchSeconds: video.min_watch_seconds,
                    viewerEarningPoints: Math.floor(parseFloat(video.price_per_view) * VIEWER_SHARE * POINTS_PER_REAL),
                    isOwner: false,
                }
            });
        } catch (error) {
            console.error('[PROMO-VIDEOS] Erro ao iniciar view:', error);
            return c.json({ success: false, message: 'Erro ao iniciar' }, 500);
        }
    }

    /**
     * Completar view e receber pagamento
     */
    static async completeView(c: Context) {
        try {
            const userPayload = c.get('user');
            const videoId = c.req.param('videoId');
            const body = await c.req.json();
            const watchTime = body.watchTimeSeconds || 0;
            const pool = getDbPool(c);

            const viewResult = await pool.query(`
                SELECT pvv.*, pv.price_per_view, pv.min_watch_seconds, pv.budget, pv.spent, pv.total_views, pv.video_url, pv.require_like, pv.require_comment, pv.require_subscribe, pv.external_initial_likes, pv.external_initial_comments, pv.external_initial_subscribers, pv.status
                FROM promo_video_views pvv
                JOIN promo_videos pv ON pvv.video_id = pv.id
                WHERE pvv.video_id = $1 AND pvv.viewer_id = $2 AND pvv.completed = FALSE
            `, [videoId, userPayload.id]);

            if (viewResult.rows.length === 0) return c.json({ success: false, message: 'Não encontrado ou já concluído' }, 404);

            const view = viewResult.rows[0];
            const viewerEarningAmount = parseFloat(view.price_per_view) * VIEWER_SHARE;
            const viewerEarningPoints = Math.floor(viewerEarningAmount * POINTS_PER_REAL);

            // Anti-Cheat
            const startTime = new Date(view.started_at).getTime();
            const now = Date.now();
            const elapsedSeconds = (now - startTime) / 1000;

            if (elapsedSeconds < (view.min_watch_seconds - 2)) {
                return c.json({ success: false, message: 'Segurança: Você está assistindo rápido demais.' }, 400);
            }

            if (watchTime < view.min_watch_seconds) return c.json({ success: false, message: 'Tempo insuficiente capturado pelo player.' }, 400);

            const missionsCompleted = body.missionsCompleted || [];
            const liked = missionsCompleted.includes('like');
            const commented = missionsCompleted.includes('comment');
            const subscribed = missionsCompleted.includes('subscribe');

            let missionPoints = 0;
            if (liked) missionPoints += 5;
            if (commented) missionPoints += 10;
            if (subscribed) missionPoints += 15;

            const isBot = body.isBot || false;

            if (isBot) {
                await pool.query('UPDATE users SET status = $1 WHERE id = $2', ['SUSPENDED', userPayload.id]);
                return c.json({ success: false, message: 'Erro de segurança: Comportamento suspeito detectado.' }, 403);
            }

            await executeInTransaction(pool, async (client) => {
                const viewUpdate = await client.query(`
                    UPDATE promo_video_views SET 
                        completed = TRUE, 
                        watch_time_seconds = $1, 
                        earned = $2, 
                        finished_at = NOW(),
                        liked = $5,
                        commented = $6,
                        subscribed = $7
                    WHERE video_id = $3 AND viewer_id = $4
                    RETURNING id
                `, [watchTime, viewerEarningAmount, videoId, userPayload.id, liked, commented, subscribed]);

                await client.query(`
                    UPDATE promo_videos SET total_views = total_views + 1, spent = spent + $1 WHERE id = $2
                `, [viewerEarningAmount, videoId]);

                await client.query('UPDATE users SET video_points = video_points + $1 WHERE id = $2', [viewerEarningPoints, userPayload.id]);

                if (missionPoints > 0) {
                    await client.query(`
                        INSERT INTO pending_mission_rewards (user_id, video_id, view_id, points, status)
                        VALUES ($1, $2, $3, $4, 'PENDING')
                    `, [userPayload.id, videoId, viewUpdate.rows[0].id, missionPoints]);

                    await client.query('UPDATE users SET pending_video_points = pending_video_points + $1 WHERE id = $2', [missionPoints, userPayload.id]);
                }

                // Auditoria Triple-Check (A cada 20 views)
                const currentTotalViews = parseInt(view.total_views) + 1;
                if (currentTotalViews % 20 === 0 && (view.require_like || view.require_comment || view.require_subscribe)) {
                    const stats = await getYouTubeFullStats(view.video_url);
                    if (stats) {
                        const likesTargetRes = await client.query('SELECT COUNT(*) FROM promo_video_views WHERE video_id = $1 AND liked = TRUE', [videoId]);
                        const likesTarget = parseInt(likesTargetRes.rows[0].count);
                        const likesGrowth = stats.likes - view.external_initial_likes;

                        const commentsTargetRes = await client.query('SELECT COUNT(*) FROM promo_video_views WHERE video_id = $1 AND commented = TRUE', [videoId]);
                        const commentsTarget = parseInt(commentsTargetRes.rows[0].count);
                        const commentsGrowth = stats.comments - view.external_initial_comments;

                        const subsTargetRes = await client.query('SELECT COUNT(*) FROM promo_video_views WHERE video_id = $1 AND subscribed = TRUE', [videoId]);
                        const subsTarget = parseInt(subsTargetRes.rows[0].count);
                        const subsGrowth = stats.subscribers - view.external_initial_subscribers;

                        let totalWeights = 0;
                        let successScore = 0;

                        if (view.require_like && likesTarget > 0) {
                            successScore += (likesGrowth / likesTarget) > 0.4 ? 100 : 0;
                            totalWeights++;
                        }
                        if (view.require_comment && commentsTarget > 0) {
                            successScore += (commentsGrowth / commentsTarget) > 0.4 ? 100 : 0;
                            totalWeights++;
                        }
                        if (view.require_subscribe && subsTarget > 0) {
                            successScore += (subsGrowth / subsTarget) > 0.4 ? 100 : 0;
                            totalWeights++;
                        }

                        const finalHealth = totalWeights > 0 ? (successScore / totalWeights) : 100;

                        let statusUpdate = view.status;
                        let rejectionReason = null;

                        if (finalHealth < 40) {
                            statusUpdate = 'PAUSED';
                            rejectionReason = 'SUSPEITA DE FRAUDE: Baixa taxa de engajamento real detectada.';
                        }

                        await client.query(`
                            UPDATE promo_videos SET 
                                external_current_likes = $1, 
                                external_current_comments = $2,
                                external_current_subscribers = $3,
                                audit_health_score = $4, 
                                last_audit_at = NOW(),
                                status = $5,
                                rejection_reason = $6
                            WHERE id = $7
                        `, [stats.likes, stats.comments, stats.subscribers, finalHealth, statusUpdate, rejectionReason, videoId]);

                        if (finalHealth >= 70) {
                            const pendingToApprove = await client.query(`
                                SELECT id, user_id, points FROM pending_mission_rewards 
                                WHERE video_id = $1 AND status = 'PENDING'
                            `, [videoId]);

                            for (const reward of pendingToApprove.rows) {
                                await client.query('UPDATE users SET video_points = video_points + $1, pending_video_points = pending_video_points - $1 WHERE id = $2', [reward.points, reward.user_id]);
                                await client.query('UPDATE pending_mission_rewards SET status = \'APPROVED\', processed_at = NOW() WHERE id = $1', [reward.id]);
                            }
                        }
                    }
                }
            });

            return c.json({ success: true, message: `Ganhou ${viewerEarningPoints} pontos!` });
        } catch (error) {
            console.error('[PROMO-VIDEOS] Erro ao completar view:', error);
            return c.json({ success: false, message: 'Erro ao processar' }, 500);
        }
    }

    /**
     * Buscar dados de pagamento de uma campanha PENDING (PIX Manual)
     */
    static async getPaymentInfo(c: Context) {
        try {
            const userPayload = c.get('user');
            const videoId = c.req.param('id');
            const pool = getDbPool(c);

            const videoResult = await pool.query(
                'SELECT * FROM promo_videos WHERE id = $1 AND user_id = $2',
                [videoId, userPayload.id]
            );

            if (videoResult.rows.length === 0) {
                return c.json({ success: false, message: 'Campanha não encontrada.' }, 404);
            }

            const video = videoResult.rows[0];

            return c.json({
                success: true,
                data: {
                    status: video.status,
                    budgetGross: parseFloat(video.budget_gross),
                    manualPix: {
                        key: ADMIN_PIX_KEY,
                        owner: 'Cred30',
                        amount: parseFloat(video.budget_gross),
                        description: `Transferência para campanha: ${video.title}`
                    }
                }
            });
        } catch (error: any) {
            console.error('[PROMO-VIDEOS] Erro ao buscar pagamento:', error);
            return c.json({ success: false, message: error.message || 'Erro ao buscar pagamento' }, 500);
        }
    }
}
