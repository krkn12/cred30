const { Client } = require('pg');

const c = new Client('postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
    await c.connect();

    console.log('🚀 Criando fluxo completo de teste (Logística)...');

    try {
        // 1. Pegar ou Criar um Vendedor
        const sellerEmail = 'vendedor_logistica@cred30.site';
        let sellerRes = await c.query("SELECT id FROM users WHERE email = $1", [sellerEmail]);
        let sellerId;

        if (sellerRes.rows.length === 0) {
            const ins = await c.query(`
                INSERT INTO users (email, name, role, balance, score, is_seller, is_verified, password_hash, secret_phrase, pix_key)
                VALUES ($1, 'Restaurante Sabor Pará', 'USER', 1000, 1000, TRUE, TRUE, 'hash', 'secret', $1)
                RETURNING id
            `, [sellerEmail]);
            sellerId = ins.rows[0].id;
            console.log(`✅ Vendedor criado: ID ${sellerId}`);
        } else {
            sellerId = sellerRes.rows[0].id;
        }

        // 2. Criar um Comprador
        const buyerEmail = 'cliente_fome@cred30.site';
        let buyerRes = await c.query("SELECT id FROM users WHERE email = $1", [buyerEmail]);
        let buyerId;

        if (buyerRes.rows.length === 0) {
            const ins = await c.query(`
                INSERT INTO users (email, name, role, balance, score, password_hash, secret_phrase, pix_key)
                VALUES ($1, 'Cliente Faminto', 'USER', 500, 800, 'hash', 'secret', $1)
                RETURNING id
            `, [buyerEmail]);
            buyerId = ins.rows[0].id;
            console.log(`✅ Comprador criado: ID ${buyerId}`);
        } else {
            buyerId = buyerRes.rows[0].id;
        }

        // 3. Criar um Anúncio (Listing)
        const listingRes = await c.query(`
            INSERT INTO marketplace_listings (seller_id, title, description, price, category, status)
            VALUES ($1, 'Açaí Completo 1L', 'Acompanha granola, banana e leite em pó.', 35.00, 'Alimentos', 'ACTIVE')
            RETURNING id
        `, [sellerId]);
        const listingId = listingRes.rows[0].id;
        console.log(`✅ Anúncio criado: ID ${listingId}`);

        // 4. Criar as Entregas (Orders)
        const delivs = [
            {
                p_addr: 'Tv. Padre Eutíquio, 1200, Belém - PA',
                p_lat: -1.4558, p_lng: -48.4902,
                d_addr: 'Av. Nazaré, 500, Belém - PA',
                d_lat: -1.4500, d_lng: -48.4800,
                fee: 10.00
            },
            {
                p_addr: 'Rua Boaventura da Silva, 450, Belém - PA',
                p_lat: -1.4420, p_lng: -48.4850,
                d_addr: 'Rua dos Mundurucus, 2000, Belém - PA',
                d_lat: -1.4600, d_lng: -48.4950,
                fee: 12.00
            }
        ];

        for (const [i, d] of delivs.entries()) {
            await c.query(`
                INSERT INTO marketplace_orders (
                    buyer_id, 
                    seller_id, 
                    listing_id, 
                    amount, 
                    status, 
                    delivery_status, 
                    delivery_fee, 
                    fee_amount,
                    pickup_address, 
                    pickup_lat, 
                    pickup_lng, 
                    delivery_address, 
                    delivery_lat, 
                    delivery_lng,
                    seller_amount,
                    delivery_type
                ) VALUES ($1, $2, $3, $4, 'WAITING_SHIPPING', 'AVAILABLE', $5, $6, $7, $8, $9, $10, $11, $12, $13, 'DELIVERY')
            `, [
                buyerId, sellerId, listingId, 35.00,
                d.fee, (35.00 * 0.10), // fee_amount = 10%
                d.p_addr, d.p_lat, d.p_lng,
                d.d_addr, d.d_lat, d.d_lng,
                35.00 - (35.00 * 0.10) // seller_amount
            ]);
            console.log(`✅ Entrega ${i + 1} criada!`);
        }

    } catch (err) {
        console.error('❌ ERRO:', err.message);
    } finally {
        await c.end();
    }
}

main();
