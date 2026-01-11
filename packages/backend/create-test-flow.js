const { Client } = require('pg');

const c = new Client('postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
    await c.connect();

    console.log('🚀 Iniciando criação de fluxo de teste completo...');

    // 1. Limpar ordens de teste anteriores se houver (opcional)
    // await c.query("DELETE FROM marketplace_orders WHERE pickup_address LIKE '%Batista Campos%'");

    // 2. Criar um anúncio (listing) de teste
    const sellerId = 1; // Admin
    const listingIdRes = await c.query(`
        INSERT INTO marketplace_listings 
        (seller_id, title, description, price, category, status, image_url, condition, city, state)
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
    `, [sellerId, 'Produto de Teste Logística', 'Descrição do produto de teste para validar o mapa', 100.00, 'Eletrônicos', 'ACTIVE', 'https://picsum.photos/200', 'NEW', 'Belém', 'PA']);

    const listingId = listingIdRes.rows[0].id;
    console.log(`✅ Anúncio criado: ID ${listingId}`);

    // 3. Criar 2 ordens vinculadas a esse anúncio
    const buyerId = 20;

    // Coordenadas de teste em Belém
    const deliveries = [
        {
            pickup: 'Rua dos Mundurucus, 1500, Batista Campos, Belém - PA',
            delivery: 'Avenida Visconde de Souza Franco, 100, Umarizal, Belém - PA',
            plat: -1.4558, plng: -48.4902, dlat: -1.4458, dlng: -48.4802,
            fee: 15.00
        },
        {
            pickup: 'Rua Boaventura da Silva, 500, Reduto, Belém - PA',
            delivery: 'Avenida Nazaré, 800, Nazaré, Belém - PA',
            plat: -1.4400, plng: -48.4850, dlat: -1.4520, dlng: -48.4750,
            fee: 20.00
        }
    ];

    for (const d of deliveries) {
        const orderRes = await c.query(`
            INSERT INTO marketplace_orders 
            (buyer_id, seller_id, listing_id, amount, status, delivery_status, delivery_fee, 
             pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, 
             created_at)
            VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
            RETURNING id
        `, [buyerId, sellerId, listingId, 100.00, 'WAITING_SHIPPING', 'AVAILABLE', d.fee, d.pickup, d.delivery, d.plat, d.plng, d.dlat, d.dlng]);

        console.log(`✅ Ordem criada: ID ${orderRes.rows[0].id}`);
    }

    console.log('\n✨ Fluxo de teste finalizado! Verifique o mapa agora.');
    await c.end();
}

main().catch(console.error);
