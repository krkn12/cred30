import { Context } from 'hono';
import { z } from 'zod';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { executeInTransaction, lockUserBalance, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';
import { UserContext } from '../../../shared/types/hono.types';

// Schemas
// Update Schema to include variants and images
const createListingSchema = z.object({
    title: z.string().min(3),
    description: z.string().min(10),
    price: z.coerce.number().min(0.01),
    category: z.string().optional().default('OUTROS'),
    imageUrl: z.string().optional(), // Mantido para compatibilidade (será a imagem principal)
    images: z.array(z.string()).optional(), // Array de URLs (Base64 ou Links)
    variants: z.array(z.object({
        name: z.string().optional(),
        color: z.string().optional(),
        size: z.string().optional(),
        stock: z.coerce.number().int().min(0).default(0),
        price: z.coerce.number().optional()
    })).optional(),
    itemType: z.enum(['PHYSICAL', 'DIGITAL']).optional().default('PHYSICAL'),
    digitalContent: z.string().optional(),
    requiredVehicle: z.enum(['BIKE', 'MOTO', 'CAR', 'TRUCK']).optional().default('MOTO'),
    stock: z.coerce.number().int().min(1).optional().default(1), // Estoque total/fallback
    pickupAddress: z.string().optional(),
    postalCode: z.string().optional(),
});

export class MarketplaceListingsController {

    /**
     * Listar todos os anúncios ativos com filtros
     */
    static async getListings(c: Context) {
        try {
            const pool = getDbPool(c);
            const { category, search, city, state, minPrice, maxPrice } = c.req.query();

            let query = `
                SELECT l.*, u.name as seller_name, u.is_verified as seller_verified,
                u.seller_address_city as city, u.seller_address_state as state,
                u.seller_address_neighborhood as neighborhood
                FROM marketplace_listings l
                JOIN users u ON l.seller_id = u.id
                WHERE l.status = 'ACTIVE' AND l.stock > 0
            `;
            const params: any[] = [];
            let pIndex = 1;

            if (category && category !== 'TODOS') {
                query += ` AND l.category = $${pIndex++}`;
                params.push(category);
            }

            if (search) {
                query += ` AND (l.title ILIKE $${pIndex} OR l.description ILIKE $${pIndex})`;
                params.push(`%${search}%`);
                pIndex++;
            }

            if (city) {
                query += ` AND u.seller_address_city = $${pIndex++}`;
                params.push(city);
            }

            if (state) {
                query += ` AND u.seller_address_state = $${pIndex++}`;
                params.push(state);
            }

            if (minPrice) {
                query += ` AND l.price >= $${pIndex++}`;
                params.push(parseFloat(minPrice));
            }

            if (maxPrice) {
                query += ` AND l.price <= $${pIndex++}`;
                params.push(parseFloat(maxPrice));
            }

            query += ` ORDER BY l.is_boosted DESC, l.created_at DESC LIMIT 100`;

            const result = await pool.query(query, params);
            return c.json({ success: true, data: { listings: result.rows } });
        } catch (error: any) {
            console.error('Get Listings Error:', error.message, error.stack);
            return c.json({ success: false, message: error.message || 'Erro ao buscar anúncios' }, 500);
        }
    }

    /**
     * Obter detalhes do anúncio (Publico)
     */
    static async getListingDetails(c: Context) {
        try {
            const pool = getDbPool(c);
            const id = c.req.param('id');

            const listingRes = await pool.query(`
                SELECT 
                    l.*, 
                    u.name as seller_name, 
                    u.is_verified as seller_verified,
                    u.avatar_url as seller_avatar,
                    COALESCE(u.seller_rating, 0) as seller_rating,
                    (SELECT COUNT(*) FROM marketplace_orders WHERE seller_id = l.seller_id AND status = 'COMPLETED') as sales_count,
                    COALESCE(
                        u.address,
                        CONCAT_WS(', ', 
                            u.seller_address_street, 
                            u.seller_address_number, 
                            u.seller_address_neighborhood, 
                            CONCAT_WS('/', u.seller_address_city, u.seller_address_state)
                        )
                    ) as seller_address
                FROM marketplace_listings l
                JOIN users u ON l.seller_id = u.id
                WHERE l.id = $1
            `, [id]);

            if (listingRes.rows.length === 0) return c.json({ success: false, message: 'Anúncio não encontrado' }, 404);
            const listing = listingRes.rows[0];

            // Buscar imagens
            const imagesRes = await pool.query(
                'SELECT image_url, id FROM marketplace_listing_images WHERE listing_id = $1 ORDER BY display_order ASC',
                [id]
            );

            // Buscar variantes
            const variantsRes = await pool.query(
                'SELECT id, name, color, size, stock, price FROM marketplace_listing_variants WHERE listing_id = $1 ORDER BY id ASC',
                [id]
            );

            return c.json({
                success: true,
                data: {
                    ...listing,
                    images: imagesRes.rows.map(r => r.image_url),
                    variants: variantsRes.rows
                }
            });

        } catch (error) {
            console.error('Error fetching details:', error);
            return c.json({ success: false, message: 'Erro ao buscar detalhes' }, 500);
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

            const {
                title, description, price, category, imageUrl, images, variants,
                itemType, digitalContent, requiredVehicle, stock, pickupAddress, postalCode
            } = parseResult.data;

            // ... (digital check kept)
            if (itemType === 'DIGITAL' && !digitalContent) {
                return c.json({
                    success: false,
                    message: 'Itens digitais precisam de um link ou código para entrega automática.'
                }, 400);
            }

            // Atualizar GPS do vendedor
            const { city, state, neighborhood, postalCode: bodyPostalCode } = body;
            if (city && state) {
                await pool.query(
                    'UPDATE users SET seller_address_city = $1, seller_address_state = $2, seller_address_neighborhood = $3, seller_address_postal_code = $4 WHERE id = $5',
                    [city, state, neighborhood || null, bodyPostalCode || postalCode || null, user.id]
                );
            }

            // Transaction
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Insert Main Listing
                // Se variants exist, 'stock' can be sum of variants or just the fallback. 
                // We keep it as is, frontend sends total.
                const mainImage = imageUrl || (images && images.length > 0 ? images[0] : null);

                const result = await client.query(
                    `INSERT INTO marketplace_listings (
                        seller_id, title, description, price, category, image_url, 
                        item_type, digital_content, required_vehicle, stock, pickup_address, pickup_postal_code
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, *`,
                    [
                        user.id, title, description, price, category, mainImage,
                        itemType, digitalContent || null, requiredVehicle, stock || 1, pickupAddress || null, postalCode || bodyPostalCode || null
                    ]
                );
                const listing = result.rows[0];
                const listingId = listing.id;

                // 2. Insert Images (Gallery)
                if (images && images.length > 0) {
                    // Start loop from 0, or 1 if index 0 is used as main? 
                    // Let's insert ALL into gallery for completeness.
                    let order = 0;
                    for (const img of images) {
                        await client.query(
                            'INSERT INTO marketplace_listing_images (listing_id, image_url, display_order) VALUES ($1, $2, $3)',
                            [listingId, img, order++]
                        );
                    }
                } else if (imageUrl) {
                    // Backward compatibility: insert main image into gallery too
                    await client.query(
                        'INSERT INTO marketplace_listing_images (listing_id, image_url, display_order) VALUES ($1, $2, 0)',
                        [listingId, imageUrl]
                    );
                }

                // 3. Insert Variants
                if (variants && variants.length > 0) {
                    for (const v of variants) {
                        await client.query(
                            `INSERT INTO marketplace_listing_variants (listing_id, name, color, size, stock, price) 
                             VALUES ($1, $2, $3, $4, $5, $6)`,
                            [listingId, v.name || `${v.color || ''} ${v.size || ''}`.trim(), v.color || null, v.size || null, v.stock, v.price || null]
                        );
                    }
                }

                await client.query('COMMIT');

                return c.json({
                    success: true,
                    listing: listing,
                    message: 'Anúncio publicado com sucesso!'
                });

            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }

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
                `SELECT id, title, description, price, category, image_url, status, is_boosted, created_at, required_vehicle, stock, pickup_address
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
                    u.name as seller_name, 
                    COALESCE(u.phone, u.pix_key) as seller_phone, 
                    COALESCE(
                        u.address,
                        CONCAT_WS(', ', 
                            u.seller_address_street, 
                            u.seller_address_number, 
                            u.seller_address_neighborhood, 
                            CONCAT_WS('/', u.seller_address_city, u.seller_address_state)
                        )
                    ) as seller_address,
                    u.is_verified as seller_verified,
                    l.stock,
                    COALESCE(l.pickup_address, CONCAT_WS(', ', 
                        u.seller_address_neighborhood, 
                        u.seller_address_city, 
                        u.seller_address_state
                    )) as pickup_address
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
