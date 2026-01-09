import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const PICKUP_ADDRESSES = [
    { lat: -1.4557, lng: -48.4902, address: "Blvd. Castilhos França, 532 - Campina, Belém - PA, 66010-020" },
    { lat: -1.4371, lng: -48.4704, address: "Av. Visconde de Souza Franco, 1200 - Reduto, Belém - PA, 66053-000" },
    { lat: -1.4253, lng: -48.4552, address: "Tv. Padre Eutíquio, 890 - Batista Campos, Belém - PA, 66023-030" },
    { lat: -1.4646, lng: -48.4842, address: "Av. Boulevard Castilhos França, 412 - Cidade Velha, Belém - PA, 66010-020" },
];

const DELIVERY_ADDRESSES = [
    { lat: -1.4423, lng: -48.4900, address: "Rua Fernando Guilhon, 45 - Umarizal, Belém - PA, 66060-010" },
    { lat: -1.4720, lng: -48.4600, address: "Av. Nazaré, 1055 - Nazaré, Belém - PA, 66035-170" },
    { lat: -1.4489, lng: -48.4666, address: "Rua dos Mundurucus, 1578 - Jurunas, Belém - PA, 66025-660" },
    { lat: -1.4312, lng: -48.4801, address: "Av. Senador Lemos, 3300 - Marco, Belém - PA, 66093-012" },
];

async function run() {
    const client = await pool.connect();
    try {
        console.log('🔧 Atualizando endereços dos pedidos...\n');

        // Buscar todos os pedidos
        const orders = await client.query(`SELECT id FROM marketplace_orders`);

        for (let i = 0; i < orders.rows.length; i++) {
            const orderId = orders.rows[i].id;
            const pickup = PICKUP_ADDRESSES[i % PICKUP_ADDRESSES.length];
            const delivery = DELIVERY_ADDRESSES[i % DELIVERY_ADDRESSES.length];

            await client.query(`
                UPDATE marketplace_orders 
                SET pickup_address = $1, pickup_lat = $2, pickup_lng = $3,
                    delivery_address = $4, delivery_lat = $5, delivery_lng = $6
                WHERE id = $7
            `, [pickup.address, pickup.lat, pickup.lng, delivery.address, delivery.lat, delivery.lng, orderId]);

            console.log(`✅ Pedido #${orderId} atualizado:`);
            console.log(`   📍 Coleta: ${pickup.address}`);
            console.log(`   📍 Entrega: ${delivery.address}`);
        }

        console.log('\n🎉 Todos os pedidos atualizados com endereços completos!');

    } catch (e) {
        console.error('❌ Erro:', e);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
