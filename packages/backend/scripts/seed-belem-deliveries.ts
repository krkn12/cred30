
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import path from 'path';

// Carregar .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Coordenadas centrais de Belém, PA
// Algumas coordenadas variadas para parecer real
const LOCATIONS = [
    { lat: -1.4557, lng: -48.4902 }, // Ver-o-Peso
    { lat: -1.4371, lng: -48.4704 }, // Shopping Boulevard
    { lat: -1.4253, lng: -48.4552 }, // Parque do Utinga
    { lat: -1.4646, lng: -48.4842 }, // Praça Batista Campos
    { lat: -1.4423, lng: -48.4900 }, // Doca
    { lat: -1.4720, lng: -48.4600 }, // Canudos
];

async function seed() {
    console.log('🌱 Iniciando Seed de Entregas em Belém...');

    try {
        const client = await pool.connect();

        // 1. Criar Vendedor
        const sellerId = uuidv4();
        await client.query(`
            INSERT INTO users (id, email, password, name, cpf, phone, balance, score, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 0, 800, NOW())
            ON CONFLICT (email) DO NOTHING
        `, [sellerId, 'vendedor_belem@mail.com', 'hashed_pass', 'Açaí do Zé', '00000000001', '91999999999']);

        // Recuperar ID real caso já exista
        const sellerRes = await client.query("SELECT id FROM users WHERE email = 'vendedor_belem@mail.com'");
        const finalSellerId = sellerRes.rows[0].id;

        // 2. Criar Comprador
        const buyerId = uuidv4();
        await client.query(`
            INSERT INTO users (id, email, password, name, cpf, phone, balance, score, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 1000, 500, NOW())
            ON CONFLICT (email) DO NOTHING
        `, [buyerId, 'cliente_belem@mail.com', 'hashed_pass', 'Maria da Paz', '00000000002', '91988888888']);

        const buyerRes = await client.query("SELECT id FROM users WHERE email = 'cliente_belem@mail.com'");
        const finalBuyerId = buyerRes.rows[0].id;

        // 3. Criar Produtos e Pedidos
        const products = [
            { title: 'Açaí do Bom (1L)', price: 25.00 },
            { title: 'Tacacá Quente', price: 15.00 },
            { title: 'Farinha de Bragança (Kg)', price: 10.00 },
            { title: 'Maniçoba da Vovó', price: 40.00 },
            { title: 'Notebook Usado', price: 500.00 }
        ];

        for (const [index, prod] of products.entries()) {
            // Criar Anúncio
            const listingId = uuidv4();
            await client.query(`
                INSERT INTO marketplace_listings 
                (id, seller_id, title, description, price, category, condition, status, created_at)
                VALUES ($1, $2, $3, $4, $5, 'Alimentos', 'NEW', 'ACTIVE', NOW())
            `, [listingId, finalSellerId, prod.title, 'Delícia de Belém', prod.price]);

            // Definir locais aleatórios
            const pickup = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
            const delivery = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

            // Criar Pedido Pronto para Entrega
            const orderId = uuidv4();
            await client.query(`
                INSERT INTO marketplace_orders
                (id, buyer_id, listing_id, seller_id, total_amount, status, delivery_type, delivery_status, delivery_fee, created_at, 
                 pickup_lat, pickup_lng, delivery_lat, delivery_lng)
                VALUES ($1, $2, $3, $9, $4, 'PAID', 'DELIVERY', 'AVAILABLE', 5.00, NOW(), $5, $6, $7, $8)
            `, [orderId, finalBuyerId, listingId, prod.price + 5.00,
                pickup.lat, pickup.lng, delivery.lat, delivery.lng, finalSellerId]);

            console.log(`📦 Pedido criado: ${prod.title} (De: ${pickup.lat},${pickup.lng} -> Para: ${delivery.lat},${delivery.lng})`);
        }

        console.log('✅ Seed finalizado com sucesso! 5 Pedidos disponíveis em Belém.');
        client.release();
    } catch (error) {
        console.error('❌ Erro no seed:', error);
    } finally {
        await pool.end();
    }
}

seed();
