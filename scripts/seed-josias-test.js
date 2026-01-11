require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        // Encontrar usuários e listings válidos
        const userRes = await pool.query('SELECT id FROM users LIMIT 2');
        if (userRes.rows.length < 2) {
            console.error('❌ Precisa de pelo menos 2 usuários no banco.');
            return;
        }
        const sellerId = userRes.rows[0].id;
        const buyerId = userRes.rows[1].id;

        const listingRes = await pool.query('SELECT id, price FROM marketplace_listings LIMIT 2');
        if (listingRes.rows.length < 2) {
            console.error('❌ Precisa de pelo menos 2 listings no banco.');
            return;
        }

        console.log(`Usando Seller: ${sellerId}, Buyer: ${buyerId}`);

        // Josias Address (Dois Amigos n13): -1.4053, -48.4949
        const deliveries = [
            {
                listingId: listingRes.rows[0].id,
                price: listingRes.rows[0].price,
                pickupLat: -1.4085,
                pickupLng: -48.4975,
                pickupAddr: 'Av. Arthur Bernardes, 500, Belém - PA'
            },
            {
                listingId: listingRes.rows[1].id,
                price: listingRes.rows[1].price,
                pickupLat: -1.4120,
                pickupLng: -48.5020,
                pickupAddr: 'Av. Arthur Bernardes, 1200, Belém - PA'
            }
        ];

        for (const d of deliveries) {
            const amount = d.price;
            const fee = amount * 0.10;
            const sellerAmt = amount - fee;
            const deliveryFee = 7.50;

            const sql = `
                INSERT INTO marketplace_orders 
                (buyer_id, listing_id, seller_id, amount, fee_amount, seller_amount, status, delivery_type, delivery_status, delivery_fee, 
                 pickup_lat, pickup_lng, pickup_address, delivery_lat, delivery_lng, delivery_address, contact_phone, created_at) 
                VALUES 
                ($1, $2, $3, $4, $5, $6, 'WAITING_SHIPPING', 'DELIVERY', 'AVAILABLE', $7, $8, $9, $10, -1.4053, -48.4949, 'Passagem Dois Amigos, 13, Belém - PA', '91999999999', CURRENT_TIMESTAMP)
            `;
            await pool.query(sql, [buyerId, d.listingId, sellerId, amount, fee, sellerAmt, deliveryFee, d.pickupLat, d.pickupLng, d.pickupAddr]);
        }

        console.log('✅ Duas entregas inseridas perto de você no sentido Arthur Bernardes!');
    } catch (e) {
        console.error('❌ Erro:', e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
