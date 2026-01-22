const { Client } = require('pg');

const c = new Client('postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
    await c.connect();

    console.log('🚀 Criando 2 entregas de teste...');

    // 1. Garantir que temos um vendedor e um comprador
    // Usaremos ID 1 (Admin) como vendedor e ID 20 como comprador (ou vice-versa)
    const sellerId = 1;
    const buyerId = 20;

    // 2. Criar 2 Listings se necessário, ou apenas os Orders se a tabela permitir
    // Para simplificar e garantir que apareça no Marketplace/Logística, vamos inserir direto no marketplace_orders
    // Simulando que o pagamento já foi feito e o status de entrega está 'AVAILABLE'

    // Coordenadas de teste em Belém (onde o projeto parece focar)
    // Coleta 1: Batista Campos
    // Entrega 1: Umarizal
    const delivery1 = {
        listing_id: null,
        buyer_id: buyerId,
        seller_id: sellerId,
        amount: 50.00,
        status: 'PAID',
        delivery_status: 'AVAILABLE',
        delivery_fee: 15.00,
        pickup_address: 'Rua dos Mundurucus, 1500, Batista Campos, Belém - PA',
        delivery_address: 'Avenida Visconde de Souza Franco, 100, Umarizal, Belém - PA',
        pickup_lat: -1.4558,
        pickup_lng: -48.4902,
        delivery_lat: -1.4458,
        delivery_lng: -48.4802,
        item_title: 'Hambúrguer Gourmet + Refri',
        created_at: new Date()
    };

    // Coleta 2: Reduto
    // Entrega 2: Nazaré
    const delivery2 = {
        listing_id: null,
        buyer_id: buyerId,
        seller_id: sellerId,
        amount: 120.00,
        status: 'PAID',
        delivery_status: 'AVAILABLE',
        delivery_fee: 20.00,
        pickup_address: 'Rua Boaventura da Silva, 500, Reduto, Belém - PA',
        delivery_address: 'Avenida Nazaré, 800, Nazaré, Belém - PA',
        pickup_lat: -1.4400,
        pickup_lng: -48.4850,
        delivery_lat: -1.4520,
        delivery_lng: -48.4750,
        item_title: 'Kit Gamer Semi-novo',
        created_at: new Date()
    };

    const sql = `
        INSERT INTO marketplace_orders 
        (buyer_id, seller_id, amount, status, delivery_status, delivery_fee, pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, item_title, created_at)
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14),
        ($15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
        RETURNING id
    `;

    const params = [
        delivery1.buyer_id, delivery1.seller_id, delivery1.amount, delivery1.status, delivery1.delivery_status, delivery1.delivery_fee, delivery1.pickup_address, delivery1.delivery_address, delivery1.pickup_lat, delivery1.pickup_lng, delivery1.delivery_lat, delivery1.delivery_lng, delivery1.item_title, delivery1.created_at,
        delivery2.buyer_id, delivery2.seller_id, delivery2.amount, delivery2.status, delivery2.delivery_status, delivery2.delivery_fee, delivery2.pickup_address, delivery2.delivery_address, delivery2.pickup_lat, delivery2.pickup_lng, delivery2.delivery_lat, delivery2.delivery_lng, delivery2.item_title, delivery2.created_at
    ];

    try {
        const res = await c.query(sql, params);
        console.log('✅ 2 Pedidos de entrega criados com sucesso!');
        res.rows.forEach(r => console.log(`  - Pedido ID: ${r.id}`));
    } catch (err) {
        console.error('❌ Erro ao criar entregas:', err.message);
        console.log('Dica: Verifique se os nomes das colunas estão corretos no script.');
    }

    await c.end();
}

main().catch(console.error);
