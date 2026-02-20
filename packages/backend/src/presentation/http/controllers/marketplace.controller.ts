import { Context } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';
import { UserContext } from '../../../shared/types/hono.types';
import { executeInTransaction, lockUserBalance, updateUserBalance, createTransaction } from '../../../domain/services/transaction.service';
import { getWelcomeBenefit } from '../../../application/services/welcome-benefit.service';
import { MARKETPLACE_ESCROW_FEE_RATE, MARKETPLACE_NON_VERIFIED_FEE_RATE } from '../../../shared/constants/business.constants';

export class MarketplaceController {

    /**
     * Antecipar Recebimento (Vendedor ou Entregador)
     */
    static async anticipate(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');
            const ANTICIPATION_FEE_RATE = 0.05; // 5% de taxa

            const orderRes = await pool.query(
                'SELECT * FROM marketplace_orders WHERE id = $1',
                [orderId]
            );

            if (orderRes.rows.length === 0) return c.json({ success: false, message: 'Pedido não encontrado.' }, 404);

            const order = orderRes.rows[0];
            const metadata = order.metadata || {};

            let amountToAnticipate = 0;
            let anticipationType = ''; // 'SELLER' ou 'COURIER'

            // 1. Identificar quem está pedindo
            if (order.seller_id === user.id) {
                if (metadata.anticipated) return c.json({ success: false, message: 'Venda já antecipada.' }, 400);
                if (!['WAITING_SHIPPING', 'IN_TRANSIT'].includes(order.status)) return c.json({ success: false, message: 'Status inválido.' }, 400);

                amountToAnticipate = parseFloat(order.seller_amount);
                anticipationType = 'SELLER';
            } else if (order.courier_id === user.id) {
                if (metadata.courier_anticipated) return c.json({ success: false, message: 'Frete já antecipado.' }, 400);
                if (order.status !== 'IN_TRANSIT') return c.json({ success: false, message: 'A entrega precisa estar em andamento.' }, 400);

                amountToAnticipate = parseFloat(order.courier_fee || '0');
                anticipationType = 'COURIER';
            } else {
                return c.json({ success: false, message: 'Acesso negado para antecipação.' }, 403);
            }

            if (amountToAnticipate <= 0) return c.json({ success: false, message: 'Valor inválido.' }, 400);

            const anticipationFee = amountToAnticipate * ANTICIPATION_FEE_RATE;
            const netAmount = amountToAnticipate - anticipationFee;

            // 2. Executar
            const result = await executeInTransaction(pool, async (client: any) => {
                if (anticipationType === 'SELLER') {
                    await client.query(
                        `UPDATE marketplace_orders 
                        SET seller_amount = $1, 
                            metadata = jsonb_set(COALESCE(metadata, '{}'), '{anticipated}', 'true') 
                        WHERE id = $2`,
                        [netAmount, orderId]
                    );
                } else {
                    await client.query(
                        `UPDATE marketplace_orders 
                        SET courier_fee = $1, 
                            metadata = jsonb_set(COALESCE(metadata, '{}'), '{courier_anticipated}', 'true') 
                        WHERE id = $2`,
                        [netAmount, orderId]
                    );
                }

                await updateUserBalance(client, user.id, netAmount, 'credit');

                await client.query('UPDATE system_config SET profit_pool = profit_pool + $1', [anticipationFee]);

                await createTransaction(
                    client,
                    user.id,
                    'MARKET_ANTICIPATION',
                    netAmount,
                    `Antecipação (${anticipationType === 'SELLER' ? 'Venda' : 'Frete'}) #${orderId} (Taxa R$ ${anticipationFee.toFixed(2)})`,
                    'APPROVED'
                );

                return { netAmount, fee: anticipationFee };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);

            return c.json({
                success: true,
                message: `Antecipado! R$ ${result.data?.netAmount.toFixed(2)} disponíveis.`,
                data: result.data
            });

        } catch (error) {
            console.error('Anticipation Error:', error);
            return c.json({ success: false, message: 'Erro ao processar antecipação' }, 500);
        }
    }

    /**
     * Processar Liquidação de Saldo (Settlement)
     */
    static async processSettlement(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);

            const result = await executeInTransaction(pool, async (client: any) => {
                const userRes = await client.query('SELECT pending_balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
                const pending = parseFloat(userRes.rows[0].pending_balance || '0');

                if (pending <= 0) return { success: false, message: 'Nenhum saldo pendente para liquidar.' };

                await client.query('UPDATE users SET balance = balance + pending_balance, pending_balance = 0 WHERE id = $1', [user.id]);
                await createTransaction(client, user.id, 'SETTLEMENT_RELEASE', pending, 'Liquidação de Vendas (Liberação de Saldo Pendente)', 'APPROVED');

                return { success: true, amount: pending };
            });

            if (!result.success || !result.data?.success) {
                return c.json({ success: false, message: result.error || (result.data as any)?.message || 'Erro no processamento' }, 400);
            }

            // Type narrowing para o TS parar de reclamar
            const settlementData = result.data as { success: true, amount: number };
            return c.json({ success: true, message: `R$ ${settlementData.amount.toFixed(2)} liberados para saque.` });

        } catch (error) {
            console.error('Settlement Error:', error);
            return c.json({ success: false, message: 'Erro ao processar liquidação' }, 500);
        }
    }

    /**
     * Listar missões logísticas (Entregas disponíveis)
     */
    static async getLogisticMissions(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const { lat, lng, radius } = c.req.query();
            console.log(`[DEBUG] getLogisticMissions - User: ${user.id}, Lat: ${lat}, Lng: ${lng}, Radius: ${radius}`);

            const hasAdminVision = user.isAdmin === true || user.role === 'ADMIN';

            // Taxas para cálculo de ganhos estimados
            const FEE_VERIFIED = 0.10;
            const FEE_UNVERIFIED = 0.275;

            // Buscar status de verificação do usuário atual
            const userCheck = await pool.query('SELECT is_verified_courier FROM users WHERE id = $1', [user.id]);
            const isVerified = userCheck.rows[0]?.is_verified_courier || false;
            const feeRate = isVerified ? FEE_VERIFIED : FEE_UNVERIFIED;

            let query = `
                SELECT o.id as "orderId", o.delivery_fee as "deliveryFee", 
                       o.delivery_address as "deliveryAddress", o.pickup_address as "pickupAddress", 
                       o.pickup_lat, o.pickup_lng, o.delivery_lat, o.delivery_lng,
                       o.created_at as "createdAt", o.contact_phone as "buyerPhone",
                       COALESCE(u_seller.phone, u_seller.pix_key) as "sellerPhone",
                       l.title as "itemTitle", l.image_url as "imageUrl",
                       COALESCE(u_seller.seller_company_name, u_seller.name) as "sellerName", u_buyer.name as "buyerName",
                       (o.delivery_fee * (1 - ${feeRate})) as "courierEarnings"
                FROM marketplace_orders o
                JOIN marketplace_listings l ON o.listing_id = l.id
                JOIN users u_seller ON o.seller_id = u_seller.id
                JOIN users u_buyer ON o.buyer_id = u_buyer.id
                WHERE o.delivery_status = 'AVAILABLE'
                  AND o.status IN ('WAITING_SHIPPING', 'PREPARING', 'READY_FOR_PICKUP')
                  AND ($2 = TRUE OR (o.seller_id::text != $1::text AND o.buyer_id::text != $1::text))
                  AND (o.invited_courier_id IS NULL OR o.invited_courier_id::text = $1::text)
            `;

            const params: any[] = [user.id, hasAdminVision];
            let pIndex = 3;

            // Filtro Geográfico Otimizado (SQL) - Raio em KM (Padrão 30km)
            if (lat && lng) {
                const searchLat = parseFloat(lat);
                const searchLng = parseFloat(lng);
                const r = parseFloat(radius || '30');

                if (!isNaN(searchLat) && !isNaN(searchLng)) {
                    query += ` AND (
                        o.pickup_lat IS NULL OR
                        (6371 * acos(
                            LEAST(1, GREATEST(-1, 
                                cos(radians($${pIndex})) * cos(radians(o.pickup_lat)) *
                                cos(radians(o.pickup_lng) - radians($${pIndex + 1})) +
                                sin(radians($${pIndex})) * sin(radians(o.pickup_lat))
                            ))
                        )) <= $${pIndex + 2}
                    )`;
                    params.push(searchLat, searchLng, r);
                    pIndex += 3;
                }
            }

            query += ` ORDER BY o.delivery_fee DESC LIMIT 50`;

            const result = await pool.query(query, params);
            console.log(`[DEBUG] getLogisticMissions - Found ${result.rows.length} missions`);

            return c.json({ success: true, data: result.rows });
        } catch (error: unknown) {
            console.error('Error listing missions:', error);
            return c.json({ success: false, message: 'Erro ao buscar missões' }, 500);
        }
    }

    /**
     * Aceitar Missão Logística
     */
    static async acceptMission(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');

            const missionCheck = await pool.query('SELECT invited_courier_id FROM marketplace_orders WHERE id = $1', [orderId]);
            if (missionCheck.rows.length === 0) return c.json({ success: false, message: 'Missão não encontrada.' }, 404);

            const invitedId = missionCheck.rows[0].invited_courier_id;
            if (invitedId && invitedId !== user.id) {
                return c.json({ success: false, message: 'Esta missão foi reservada para outro entregador.' }, 403);
            }

            const result = await pool.query(
                `UPDATE marketplace_orders 
                 SET delivery_status = 'ACCEPTED', courier_id = $1, updated_at = NOW()
                 WHERE id = $2 AND delivery_status = 'AVAILABLE'
                 RETURNING pickup_code`,
                [user.id, orderId]
            );

            if (result.rows.length === 0) return c.json({ success: false, message: 'Missão não disponível ou já aceita.' }, 400);

            return c.json({
                success: true,
                message: 'Missão aceita! Dirija-se ao vendedor.',
                pickupCode: result.rows[0].pickup_code
            });
        } catch (error) {
            return c.json({ success: false, message: 'Erro ao aceitar missão' }, 500);
        }
    }

    /**
     * Confirmar Coleta de Item (Sair para entrega)
     */
    static async pickupMission(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');
            const { pickupCode } = await c.req.json();

            const result = await pool.query(
                `UPDATE marketplace_orders 
                 SET delivery_status = 'IN_TRANSIT', updated_at = NOW()
                 WHERE id = $1 AND courier_id = $2 AND pickup_code = $3 AND delivery_status = 'ACCEPTED'`,
                [orderId, user.id, pickupCode]
            );

            if (result.rowCount === 0) return c.json({ success: false, message: 'Código inválido ou missão não encontrada.' }, 400);

            return c.json({ success: true, message: 'Coleta confirmada! Inicie o trajeto.' });
        } catch (error) {
            return c.json({ success: false, message: 'Erro ao confirmar coleta' }, 500);
        }
    }

    /**
     * Atualizar localização GPS do Entregador
     */
    static async updateMissionLocation(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');
            const { lat, lng } = await c.req.json();

            if (typeof lat !== 'number' || typeof lng !== 'number') {
                return c.json({ success: false, message: 'Coordenadas inválidas' }, 400);
            }

            const result = await pool.query(
                `UPDATE marketplace_orders 
                 SET courier_lat = $1, courier_lng = $2, updated_at = NOW()
                 WHERE id = $3 AND courier_id = $4 AND status IN ('WAITING_SHIPPING', 'IN_TRANSIT')
                 RETURNING id`,
                [lat, lng, orderId, user.id]
            );

            if (result.rowCount === 0) {
                return c.json({ success: false, message: 'Pedido não encontrado ou você não é o entregador deste pedido.' }, 403);
            }

            return c.json({ success: true });
        } catch (error) {
            return c.json({ success: false, message: 'Erro ao atualizar localização' }, 500);
        }
    }

    /**
     * Confirmar Entrega Realizada (Pagamento ao Entregador)
     */
    static async confirmDelivered(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const orderId = c.req.param('id');

            // Taxas
            const FEE_VERIFIED = 0.10;
            const FEE_UNVERIFIED = 0.275;

            const result = await executeInTransaction(pool, async (client: any) => {
                // 1. Buscar Pedido e Status do Entregador
                const orderRes = await client.query(`
                    SELECT o.id, o.delivery_fee, o.delivery_status, u.is_verified_courier 
                    FROM marketplace_orders o
                    JOIN users u ON u.id = $2
                    WHERE o.id = $1 AND o.courier_id = $2
                `, [orderId, user.id]);

                if (orderRes.rows.length === 0) throw new Error('Pedido não encontrado ou não pertence a você.');

                const order = orderRes.rows[0];
                if (order.delivery_status !== 'IN_TRANSIT') throw new Error('Pedido não está em trânsito.');

                // 2. Calcular Pagamento
                const deliveryVal = parseFloat(order.delivery_fee || '0');
                if (deliveryVal <= 0) throw new Error('Valor de entrega inválido.');

                const isVerified = !!order.is_verified_courier;
                const feeRate = isVerified ? FEE_VERIFIED : FEE_UNVERIFIED;

                const platformShare = deliveryVal * feeRate;
                const courierShare = deliveryVal - platformShare;

                // 3. Atualizar Status e Pagar
                await client.query(
                    `UPDATE marketplace_orders 
                     SET delivery_status = 'DELIVERED', status = 'DELIVERED', delivered_at = NOW() 
                     WHERE id = $1`,
                    [orderId]
                );

                await updateUserBalance(client, user.id, courierShare, 'credit');
                await client.query('UPDATE system_config SET profit_pool = profit_pool + $1', [platformShare]);

                await createTransaction(
                    client, user.id, 'LOGISTIC_EARNING', courierShare,
                    `Entrega #${orderId} Realizada (${isVerified ? 'Selo Verificado 10%' : 'Sem Selo 27.5%'})`,
                    'APPROVED'
                );

                return { courierShare, platformShare };
            });

            if (!result.success) return c.json({ success: false, message: result.error }, 400);

            return c.json({
                success: true,
                message: `Entrega confirmada! Você recebeu R$ ${result.data?.courierShare.toFixed(2)}.`,
                earned: result.data?.courierShare
            });

        } catch (error) {
            console.error('Confirm Delivery Error:', error);
            return c.json({ success: false, message: 'Erro ao confirmar entrega' }, 500);
        }
    }

    /**
     * Sincronização de Vendas Offline
     */
    static async syncOffline(c: Context) {
        try {
            const user = c.get('user') as UserContext;
            const pool = getDbPool(c);
            const body = await c.req.json();

            // Usando schema local se possível ou validando manualmente
            const { transactions } = body;
            if (!Array.isArray(transactions)) return c.json({ success: false, message: 'Formato inválido' }, 400);

            const results = [];

            for (const tx of transactions) {
                const existing = await pool.query('SELECT id FROM marketplace_orders WHERE offline_token = $1', [tx.id]);
                if (existing.rows.length > 0) {
                    results.push({ id: tx.id, status: 'ALREADY_PROCESSED' });
                    continue;
                }

                if (tx.sellerId !== user.id) {
                    results.push({ id: tx.id, status: 'SKIPPED', message: 'Seller ID mismatch' });
                    continue;
                }

                try {
                    await executeInTransaction(pool, async (client: any) => {
                        const balanceCheck = await lockUserBalance(client, tx.buyerId, tx.amount, { skipLockCheck: true });
                        if (!balanceCheck.success) throw new Error(`Saldo insuficiente no comprador ${tx.buyerId}`);

                        const sellerResult = await client.query('SELECT asaas_wallet_id, is_verified_seller, seller_cpf_cnpj FROM users WHERE id = $1', [tx.sellerId]);
                        const sellerData = sellerResult.rows[0];
                        const isVerified = !!sellerData?.is_verified_seller;

                        const sellerDoc = sellerData?.seller_cpf_cnpj;
                        const docClean = sellerDoc ? sellerDoc.replace(/\D/g, '') : '';
                        const isCnpj = docClean.length === 14;
                        const isCpf = !isCnpj; // Se não é CNPJ, tratamos como CPF

                        // --- TRAVA DE VENDAS 2k (CPF) ---
                        // REGRA: CPF trava em 2k. CNPJ ilimitado.
                        if (isCpf) {
                            const startOfMonth = new Date();
                            startOfMonth.setDate(1);
                            startOfMonth.setHours(0, 0, 0, 0);

                            const salesRes = await client.query(`
                                SELECT COALESCE(SUM(amount), 0) as total 
                                FROM marketplace_orders 
                                WHERE seller_id = $1 
                                AND created_at >= $2 
                                AND status != 'CANCELLED'
                            `, [tx.sellerId, startOfMonth]);

                            const currentMonthlySales = parseFloat(salesRes.rows[0].total);
                            if (currentMonthlySales + tx.amount > 2000) {
                                throw new Error('Limite mensal de vendas para CPF atingido (R$ 2.000,00). Atualize para CNPJ para continuar vendendo.');
                            }
                        }

                        const baseFeeRate = isVerified ? MARKETPLACE_ESCROW_FEE_RATE : MARKETPLACE_NON_VERIFIED_FEE_RATE;

                        const welcomeBenefit = await getWelcomeBenefit(client, tx.buyerId);
                        const effectiveEscrowRate = welcomeBenefit.hasDiscount ? baseFeeRate * 0.5 : baseFeeRate;

                        const fee = tx.amount * effectiveEscrowRate;
                        const sellerAmount = tx.amount - fee;

                        await updateUserBalance(client, tx.buyerId, tx.amount, 'debit');
                        await updateUserBalance(client, tx.sellerId, sellerAmount, 'credit');

                        const orderResult = await client.query(
                            `INSERT INTO marketplace_orders (
                                listing_id, buyer_id, seller_id, amount, fee_amount, seller_amount, 
                                status, payment_method, offline_token, delivery_status, delivered_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING id`,
                            [null, tx.buyerId, tx.sellerId, tx.amount, fee, sellerAmount, 'COMPLETED', 'OFFLINE_QR', tx.id, 'DELIVERED']
                        );

                        const orderId = orderResult.rows[0].id;
                        await createTransaction(client, tx.buyerId, 'MARKET_PURCHASE', tx.amount, `Compra Presencial: ${tx.itemTitle}`, 'APPROVED', { orderId });
                        await createTransaction(client, tx.sellerId, 'MARKET_SALE', sellerAmount, `Venda Presencial: ${tx.itemTitle}`, 'APPROVED', { orderId });
                    });
                    results.push({ id: tx.id, status: 'SUCCESS' });
                } catch (err: unknown) {
                    console.error(`Error processing offline tx ${tx.id}:`, err);
                    results.push({ id: tx.id, status: 'FAILED', message: err.message });
                }
            }

            return c.json({ success: true, results });
        } catch (error) {
            console.error('Offline Sync Error:', error);
            return c.json({ success: false, message: 'Erro na sincronização' }, 500);
        }
    }

    /**
     * Listar estabelecimentos de delivery (Restaurantes/Lojas de Bebida)
     */
    static async getDeliveryVenues(c: Context) {
        try {
            const pool = getDbPool(c);
            const { category, city, state } = c.req.query();

            let query = `
                SELECT id, name, merchant_name, is_restaurant, is_liquor_store, 
                restaurant_category, seller_address_city as city, seller_address_state as state,
                seller_address_neighborhood as neighborhood, seller_address_street as street,
                COALESCE(avatar_url, NULL) as avatar_url, COALESCE(seller_rating, 0) as rating, opening_hours
                FROM users 
                WHERE (is_restaurant = TRUE OR is_liquor_store = TRUE)
            `;
            const params: any[] = [];
            let pIndex = 1;

            if (category && category !== 'TODOS') {
                query += ` AND restaurant_category = $${pIndex++}`;
                params.push(category);
            }

            if (city) {
                query += ` AND seller_address_city = $${pIndex++}`;
                params.push(city);
            }

            if (state) {
                query += ` AND seller_address_state = $${pIndex++}`;
                params.push(state);
            }

            query += ` ORDER BY seller_rating DESC NULLS LAST, created_at DESC LIMIT 50`;

            const result = await pool.query(query, params);
            return c.json({ success: true, data: result.rows });
        } catch (error: unknown) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Listar categorias de comida (Para o Carrossel)
     */
    static async getFoodCategories(c: Context) {
        try {
            const pool = getDbPool(c);
            const result = await pool.query(
                `SELECT * FROM marketplace_food_categories WHERE is_active = TRUE ORDER BY display_order ASC`
            );
            return c.json({ success: true, data: result.rows });
        } catch (error: unknown) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Atualizar perfil da loja (Nome Comercial, Categoria, Horários)
     */
    static async updateStoreProfile(c: Context) {
        try {
            const user = c.get('user') as any;
            const pool = getDbPool(c);
            const { merchantName, category, openingHours } = await c.req.json();

            // Validar se é vendedor
            const sellerRes = await pool.query('SELECT is_restaurant, is_liquor_store FROM users WHERE id = $1', [user.id]);
            const seller = sellerRes.rows[0];

            if (!user.isAdmin && (!seller || (!seller.is_restaurant && !seller.is_liquor_store))) {
                return c.json({ success: false, message: 'Apenas administradores ou vendedores de delivery podem configurar este perfil.' }, 403);
            }

            await pool.query(
                `UPDATE users SET 
                merchant_name = $1, 
                restaurant_category = $2, 
                opening_hours = $3 
                WHERE id = $4`,
                [merchantName, category, JSON.stringify(openingHours), user.id]
            );

            return c.json({ success: true, message: 'Perfil da loja atualizado com sucesso!' });
        } catch (error: unknown) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }

    /**
     * Alternar pausa manual da loja
     */
    static async toggleMerchantPause(c: Context) {
        try {
            const user = c.get('user') as any;
            const pool = getDbPool(c);
            const { isPaused } = await c.req.json();

            // Validar se é vendedor
            const sellerRes = await pool.query('SELECT is_restaurant, is_liquor_store FROM users WHERE id = $1', [user.id]);
            const seller = sellerRes.rows[0];

            if (!user.isAdmin && (!seller || (!seller.is_restaurant && !seller.is_liquor_store))) {
                return c.json({ success: false, message: 'Apenas administradores ou vendedores de delivery podem pausar a loja.' }, 403);
            }

            await pool.query(
                `UPDATE users SET is_paused = $1 WHERE id = $2`,
                [isPaused, user.id]
            );

            return c.json({
                success: true,
                isPaused,
                message: isPaused ? 'Loja pausada com sucesso!' : 'Loja aberta com sucesso!'
            });
        } catch (error: unknown) {
            return c.json({ success: false, message: error.message }, 500);
        }
    }
}
