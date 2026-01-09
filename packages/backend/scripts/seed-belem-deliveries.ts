
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { DELIVERY_FEE_MIN } from '../src/utils/constants';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const LOCATIONS = [
    { lat: -1.4557, lng: -48.4902, address: "Blvd. Castilhos França, 532 - Campina, Belém - PA, 66010-020" },
    { lat: -1.4371, lng: -48.4704, address: "Av. Visconde de Souza Franco, 1200 - Reduto, Belém - PA, 66053-000" },
    { lat: -1.4253, lng: -48.4552, address: "Tv. Padre Eutíquio, 890 - Batista Campos, Belém - PA, 66023-030" },
    { lat: -1.4646, lng: -48.4842, address: "Av. Boulevard Castilhos França, 412 - Cidade Velha, Belém - PA, 66010-020" },
    { lat: -1.4423, lng: -48.4900, address: "Rua Fernando Guilhon, 45 - Umarizal, Belém - PA, 66060-010" },
    { lat: -1.4720, lng: -48.4600, address: "Av. Nazaré, 1055 - Nazaré, Belém - PA, 66035-170" },
    { lat: -1.4489, lng: -48.4666, address: "Rua dos Mundurucus, 1578 - Jurunas, Belém - PA, 66025-660" },
    { lat: -1.4312, lng: -48.4801, address: "Av. Senador Lemos, 3300 - Marco, Belém - PA, 66093-012" },
];

async function getNextId(client: any, table: string): Promise<number> {
    const res = await client.query(`SELECT MAX(id) as max_id FROM ${table}`);
    const max = res.rows[0].max_id;
    return max ? parseInt(max) + 1 : 1;
}

async function getOrCreateUser(client: any, email: string, name: string, cpf: string, phone: string) {
    const res = await client.query("SELECT id FROM users WHERE email = $1", [email]);
    if (res.rows.length > 0) return res.rows[0].id;

    try {
        const insertRes = await client.query(`
            INSERT INTO users (email, name, cpf, phone, balance, score, created_at, password_hash, secret_phrase, pix_key)
            VALUES ($1, $2, $3, $4, 1000, 800, NOW(), 'temp', 'secret', $3) RETURNING id
        `, [email, name, cpf, phone]);
        return insertRes.rows[0].id;
    } catch (e: any) {
        if (e.code === '23502') {
            const nextId = await getNextId(client, 'users');
            const insertRes = await client.query(`
                INSERT INTO users (id, email, name, cpf, phone, balance, score, created_at, password_hash, secret_phrase, pix_key)
                VALUES ($1, $2, $3, $4, $5, 1000, 800, NOW(), 'temp', 'secret', $4) RETURNING id
            `, [nextId, email, name, cpf, phone]);
            return insertRes.rows[0].id;
        }
        throw e;
    }
}

async function seed() {
    console.log('🌱 Iniciando Seed "Manual Increment" com Endereços...');
    const client = await pool.connect();

    try {
        const sellerId = await getOrCreateUser(client, 'vendedor_belem@mail.com', 'Açaí do Zé', '00000000001', '91999999999');
        const buyerId = await getOrCreateUser(client, 'cliente_belem@mail.com', 'Maria da Paz', '00000000002', '91988888888');
        console.log(`IDs: Seller ${sellerId}, Buyer ${buyerId}`);

        const products = [
            { title: 'Açaí do Bom', price: 25.00 },
            { title: 'Tacacá', price: 15.00 },
            { title: 'Farinha', price: 10.00 },
            { title: 'Maniçoba', price: 30.00 },
            { title: 'Pato no Tucupi', price: 45.00 }
        ];

        let nextListingId = await getNextId(client, 'marketplace_listings');
        let nextOrderId = await getNextId(client, 'marketplace_orders');

        for (const prod of products) {
            // Listings
            try {
                await client.query(`
                    INSERT INTO marketplace_listings (id, seller_id, title, description, price, category, status, created_at)
                    VALUES ($1, $2, $3, 'Desc', $4, 'Alimentos', 'ACTIVE', NOW())
                `, [nextListingId, sellerId, prod.title, prod.price]);
                console.log(`Listing ${nextListingId} criado.`);
            } catch (e) {
                await client.query(`
                     INSERT INTO marketplace_listings (seller_id, title, description, price, category, status, created_at)
                     VALUES ($1, $2, 'Desc', $3, 'Alimentos', 'ACTIVE', NOW())
                 `, [sellerId, prod.title, prod.price]);
            }

            const listId = nextListingId;
            nextListingId++;

            const pickup = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
            const delivery = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

            const amount = prod.price;
            const fee = amount * 0.10;
            const sellerAmt = amount - fee;

            // Orders (WAITING_SHIPPING + Address)
            await client.query(`
                INSERT INTO marketplace_orders
                (id, buyer_id, listing_id, seller_id, amount, fee_amount, seller_amount, status, delivery_type, delivery_status, delivery_fee, created_at, 
                 pickup_lat, pickup_lng, pickup_address, delivery_lat, delivery_lng, delivery_address)
                VALUES ($1, $2, $3, $4, $5, $10, $11, 'WAITING_SHIPPING', 'DELIVERY', 'AVAILABLE', $14, NOW(), $6, $7, $12, $8, $9, $13)
            `, [nextOrderId, buyerId, listId, sellerId, amount, pickup.lat, pickup.lng, delivery.lat, delivery.lng, fee, sellerAmt, pickup.address, delivery.address, DELIVERY_FEE_MIN]);

            console.log(`Order ${nextOrderId} criado: ${prod.title}`);
            nextOrderId++;
        }
        console.log('✅ SUCESSO DO SEED! 5 Pedidos em Belém com Endereços.');

    } catch (error: any) {
        console.error('❌ Erro:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
