import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, lockUserBalance, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';
import { UserContext } from '../../../shared/types/hono.types';

// Schemas
const createListingSchema = z.object({
    title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres').max(255),
    description: z.string().min(5, 'Descrição deve ter pelo menos 5 caracteres'),
    price: z.number().positive('Preço deve ser maior que zero'),
    category: z.string().optional(),
    imageUrl: z.string().optional(),
    quotaId: z.number().int().optional(),
    itemType: z.enum(['PHYSICAL', 'DIGITAL']).optional().default('PHYSICAL'),
    digitalContent: z.string().optional(), // Link/código para itens digitais
    requiredVehicle: z.enum(['BIKE', 'MOTO', 'CAR', 'TRUCK']).optional().default('MOTO'),
});

export class MarketplaceListingsController {

    /**
     * Listar todos os anúncios ativos
     */
    static async getListings(c: Context) {
        try {
            const pool = getDbPool(c);
            const limit = parseInt(c.req.query('limit') || '20');
            const offset = parseInt(c.req.query('offset') || '0');
            const category = c.req.query('category');
            const search = c.req.query('search');
            const city = c.req.query('city');
            const uf = c.req.query('uf');
            const neighborhood = c.req.query('neighborhood');

            const combinedResult = await pool.query(`
        SELECT * FROM (
            (SELECT l.id::text, l.title, l.description, l.price::float, l.image_url, l.category, 
                    u.name as seller_name, l.seller_id::text, l.is_boosted, l.created_at, l.status, 'P2P' as type,
                    u.seller_address_city as city, u.seller_address_state as uf,
                    COALESCE(l.item_type, 'PHYSICAL') as item_type,
                    COALESCE(l.required_vehicle, 'MOTO') as required_vehicle
             FROM marketplace_listings l 
             JOIN users u ON l.seller_id = u.id
             WHERE l.status = 'ACTIVE'
             AND ($3::text IS NULL OR $3 = 'TODOS' OR l.category = $3)
             AND ($4::text IS NULL OR (l.title ILIKE '%' || $4 || '%' OR l.description ILIKE '%' || $4 || '%'))
             AND ($5::text IS NULL OR u.seller_address_city ILIKE '%' || $5 || '%')
             AND ($6::text IS NULL OR u.seller_address_state = $6)
             AND ($7::text IS NULL OR u.seller_address_neighborhood ILIKE '%' || $7 || '%'))
            UNION ALL
            (SELECT p.id::text, p.title, p.description, p.price::float, p.image_url, p.category, 
                    'Cred30 Parceiros' as seller_name, '0' as seller_id, true as is_boosted, p.created_at, 'ACTIVE' as status, 'AFFILIATE' as type,
                    '' as city, '' as uf, 'PHYSICAL' as item_type, 'MOTO' as required_vehicle
             FROM products p 
             WHERE p.active = true
             AND ($3::text IS NULL OR $3 = 'TODOS' OR p.category = $3)
             AND ($4::text IS NULL OR (p.title ILIKE '%' || $4 || '%' OR p.description ILIKE '%' || $4 || '%'))
             )
        ) as combined
        ORDER BY is_boosted DESC, created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset, category || null, search || null, city || null, uf || null, neighborhood || null]);

            return c.json({
                success: true,
                data: {
                    listings: combinedResult.rows,
                    pagination: { limit, offset }
                }
            });
        } catch (error) {
            console.error('Erro ao listar anúncios:', error);
            return c.json({ success: false, message: 'Erro ao buscar anúncios' }, 500);
        }
    }

    /**
     * Criar novo anúncio
     */
    static async createListing(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();
            const parseResult = createListingSchema.safeParse(body);

            if (!parseResult.success) {
                return c.json({
                    success: false,
                    message: 'Dados inválidos',
                    errors: parseResult.error.errors
                }, 400);
            }

            const { title, description, price, category, imageUrl, quotaId, itemType, digitalContent, requiredVehicle } = parseResult.data;

            // Itens digitais precisam de conteúdo digital
            if (itemType === 'DIGITAL' && !digitalContent) {
                return c.json({
                    success: false,
                    message: 'Itens digitais precisam de um link ou código para entrega automática.'
                }, 400);
            }

            // Se for uma cota, verificar se pertence ao usuário e está ativa
            if (quotaId) {
                const quotaCheck = await pool.query('SELECT * FROM quotas WHERE id = $1 AND user_id = $2 AND status = $3', [quotaId, user.id, 'ACTIVE']);
                if (quotaCheck.rows.length === 0) {
                    return c.json({ success: false, message: 'Você não possui esta cota ou ela não está ativa para repasse.' }, 403);
                }
            }

            // Atualizar localização do vendedor se fornecida (GPS)
            const { city, state, neighborhood } = body;
            if (city && state) {
                await pool.query(
                    'UPDATE users SET seller_address_city = $1, seller_address_state = $2, seller_address_neighborhood = $3 WHERE id = $4',
                    [city, state, neighborhood || null, user.id]
                );
            }

            const result = await pool.query(
                `INSERT INTO marketplace_listings (seller_id, title, description, price, category, image_url, quota_id, item_type, digital_content, required_vehicle)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
                [user.id, title, description, price, category || (quotaId ? 'COTAS' : 'OUTROS'), imageUrl, quotaId, itemType || 'PHYSICAL', digitalContent, requiredVehicle]
            );

            return c.json({
                success: true,
                listing: result.rows[0],
                message: itemType === 'DIGITAL'
                    ? 'Item digital publicado! O conteúdo será entregue automaticamente após a compra.'
                    : 'Anúncio publicado com sucesso!'
            });
        } catch (error) {
            console.error('Erro ao criar anúncio:', error);
            return c.json({ success: false, message: 'Erro ao publicar anúncio' }, 500);
        }
    }

    /**
     * Meus anúncios
     */
    static async getMyListings(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await pool.query(
                `SELECT id, title, description, price, category, image_url, status, is_boosted, created_at, required_vehicle
         FROM marketplace_listings
         WHERE seller_id = $1
         ORDER BY created_at DESC`,
                [user.id]
            );

            return c.json({ success: true, data: result.rows });
        } catch (error) {
            console.error('My Listings Error:', error);
            return c.json({ success: false, message: 'Erro ao buscar seus anúncios' }, 500);
        }
    }

    /**
     * Deletar anúncio
     */
    static async deleteListing(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const listingId = c.req.param('id');

            const result = await pool.query(
                "DELETE FROM marketplace_listings WHERE id = $1 AND seller_id = $2 AND status = 'ACTIVE' RETURNING id",
                [listingId, user.id]
            );

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Anúncio não encontrado ou não pode ser removido.' }, 404);
            }

            return c.json({ success: true, message: 'Anúncio removido com sucesso!' });
        } catch (error) {
            console.error('Delete Listing Error:', error);
            return c.json({ success: false, message: 'Erro ao remover anúncio' }, 500);
        }
    }

    /**
     * Impulsionar um anúncio (Monetização)
     */
    static async boostListing(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();
            const { listingId, paymentMethod = 'BALANCE' } = body;
            const BOOST_FEE = 5.00; // R$ 5,00 para impulsionar por 7 dias

            // 1. Buscar anúncio
            const listingRes = await pool.query(
                'SELECT * FROM marketplace_listings WHERE id = $1 AND seller_id = $2 AND status = $3',
                [listingId, user.id, 'ACTIVE']
            );
            if (listingRes.rows.length === 0) return c.json({ success: false, message: 'Anúncio não encontrado ou inválido' }, 404);
            const listing = listingRes.rows[0];

            // PAGAMENTO VIA SALDO
            if (paymentMethod === 'BALANCE') {
                const result = await executeInTransaction(pool, async (client: any) => {
                    const balanceCheck = await lockUserBalance(client, user.id, BOOST_FEE);
                    if (!balanceCheck.success) throw new Error('Saldo insuficiente para impulsionar');

                    await updateUserBalance(client, user.id, BOOST_FEE, 'debit');

                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 7);

                    await client.query(
                        'UPDATE marketplace_listings SET is_boosted = TRUE, boost_expires_at = $1 WHERE id = $2',
                        [expiresAt, listingId]
                    );

                    const taxPart = BOOST_FEE * 0.25;
                    const operPart = BOOST_FEE * 0.25;
                    const ownerPart = BOOST_FEE * 0.25;
                    const investPart = BOOST_FEE * 0.25;

                    await client.query(
                        `UPDATE system_config SET 
                            total_tax_reserve = total_tax_reserve + $1,
                            total_operational_reserve = total_operational_reserve + $2,
                            total_owner_profit = total_owner_profit + $3,
                            investment_reserve = investment_reserve + $4,
                            profit_pool = profit_pool + $5`,
                        [taxPart, operPart, ownerPart, investPart, 0]
                    );

                    await createTransaction(
                        client,
                        user.id,
                        'MARKET_BOOST',
                        BOOST_FEE,
                        `Impulsionamento de Anúncio: ${listing.title}`,
                        'APPROVED',
                        { listingId }
                    );

                    return { success: true };
                });

                if (!result.success) return c.json({ success: false, message: result.error }, 400);
                return c.json({ success: true, message: 'Seu anúncio foi impulsionado!' });
            }

            // PAGAMENTO EXTERNO (PIX/CARTÃO) - Temporariamente desativado
            return c.json({
                success: false,
                message: 'Pagamentos PIX/Cartão externos estão temporariamente indisponíveis. Por favor, deposite saldo na sua conta e use o saldo para impulsionar.'
            }, 400);

        } catch (error: any) {
            console.error('Error boosting listing:', error);
            return c.json({ success: false, message: error.message || 'Erro ao impulsionar anúncio' }, 500);
        }
    }

    /**
     * Obter contato do vendedor (consome pontos de farm)
     */
    static async getSellerContact(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const listingId = c.req.param('listingId');

            // Buscar anúncio e dados do vendedor
            const result = await pool.query(`
                SELECT 
                    l.id, l.title, l.price, l.description, l.image_url, l.seller_id,
                    u.name as seller_name, u.phone as seller_phone, u.address as seller_address,
                    u.is_verified as seller_verified
                FROM marketplace_listings l
                JOIN users u ON l.seller_id = u.id
                WHERE l.id = $1 AND l.status = 'ACTIVE'
            `, [listingId]);

            if (result.rows.length === 0) {
                return c.json({ success: false, message: 'Anúncio não encontrado ou já vendido.' }, 404);
            }

            const listing = result.rows[0];

            // Não pode contatar a si mesmo
            if (listing.seller_id === user.id) {
                return c.json({ success: false, message: 'Este é seu próprio anúncio.' }, 400);
            }

            // --- LÓGICA DE CONSUMO DE PONTOS (FARM) ---
            // Verificamos se o usuário já desbloqueou este contato antes para não cobrar duas vezes
            const alreadyContacted = await pool.query(
                'SELECT 1 FROM marketplace_contacts WHERE listing_id = $1 AND buyer_id = $2',
                [listingId, user.id]
            );

            const POINT_COST = 3;

            if (alreadyContacted.rows.length === 0) {
                // Verificar se tem pontos suficientes (ad_points)
                const userPointsRes = await pool.query('SELECT ad_points FROM users WHERE id = $1', [user.id]);
                const currentPoints = userPointsRes.rows[0]?.ad_points || 0;

                if (currentPoints < POINT_COST) {
                    return c.json({
                        success: false,
                        message: `Saldo insuficiente. Você precisa de ${POINT_COST} pontos de farm para ver o contato. Faça check-in diário ou assista vídeos para ganhar mais!`,
                        data: { currentPoints, required: POINT_COST }
                    }, 403);
                }

                // Deduzir pontos
                await pool.query(
                    'UPDATE users SET ad_points = ad_points - $1 WHERE id = $2',
                    [POINT_COST, user.id]
                );

                // Registrar interesse (para não cobrar novamente e analytics)
                await pool.query(
                    'INSERT INTO marketplace_contacts (listing_id, buyer_id, points_spent, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING',
                    [listingId, user.id, POINT_COST]
                ).catch(() => {
                    // Caso a coluna points_spent não exista ainda, tentamos sem ela
                    pool.query('INSERT INTO marketplace_contacts (listing_id, buyer_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING', [listingId, user.id]);
                });
            }

            // Formatar telefone para link do WhatsApp
            const phoneClean = listing.seller_phone?.replace(/\D/g, '') || '';
            const whatsappLink = phoneClean ? `https://wa.me/55${phoneClean}?text=Olá! Vi seu anúncio "${listing.title}" no Cred30 por R$ ${parseFloat(listing.price).toFixed(2)}. Ainda está disponível?` : null;

            return c.json({
                success: true,
                data: {
                    listing: {
                        id: listing.id,
                        title: listing.title,
                        price: parseFloat(listing.price),
                        description: listing.description,
                        image: listing.image_url
                    },
                    seller: {
                        name: listing.seller_name,
                        phone: listing.seller_phone,
                        address: listing.seller_address,
                        isVerified: listing.seller_verified || false
                    },
                    whatsapp: whatsappLink,
                    disclaimer: '⚠️ Esta é uma negociação P2P direta. A Cred30 não intermedia esta transação e não oferece garantias. Combine pagamento e entrega diretamente com o vendedor.'
                }
            });
        } catch (error) {
            console.error('Contact Route Error:', error);
            return c.json({ success: false, message: 'Erro ao obter contato' }, 500);
        }
    }
}
