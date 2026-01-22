import 'dotenv/config'; // Carregar variáveis de ambiente
import { pool } from '../src/infrastructure/database/postgresql/connection/pool';

/**
 * Script para popular dados de GPS fictícios em entregas existentes
 * Uso: npx tsx scripts/seed-gps.ts
 */
const seedGps = async () => {
    try {
        console.log('🗺️ Iniciando seed de GPS...');

        // Buscar ordens disponíveis que não têm GPS
        const orders = await pool.query(`
            SELECT id, pickup_address, delivery_address 
            FROM marketplace_orders 
            WHERE delivery_status = 'AVAILABLE' 
            AND (pickup_lat IS NULL OR delivery_lat IS NULL)
        `);

        console.log(`📍 Encontradas ${orders.rows.length} entregas disponíveis sem GPS.`);

        // Coordenadas centrais aproximadas de capitais brasileiras para gerar dados realistas
        const capitals = [
            { lat: -23.5505, lng: -46.6333, name: 'São Paulo' },
            { lat: -22.9068, lng: -43.1729, name: 'Rio de Janeiro' },
            { lat: -19.9167, lng: -43.9345, name: 'Belo Horizonte' },
            { lat: -15.7975, lng: -47.8919, name: 'Brasília' },
            { lat: -30.0346, lng: -51.2177, name: 'Porto Alegre' },
            { lat: -12.9777, lng: -38.5016, name: 'Salvador' },
            { lat: -8.0476, lng: -34.8770, name: 'Recife' },
            { lat: -3.7172, lng: -38.5434, name: 'Fortaleza' },
            { lat: -1.4558, lng: -48.4902, name: 'Belém' },
            { lat: -25.4284, lng: -49.2733, name: 'Curitiba' }
        ];

        let updatedCount = 0;

        for (const order of orders.rows) {
            // Escolher uma capital aleatória como base
            const base = capitals[Math.floor(Math.random() * capitals.length)];

            // Gerar variação aleatória pequena (+/- 0.05 graus ~ 5km)
            const pickupLat = base.lat + (Math.random() - 0.5) * 0.1;
            const pickupLng = base.lng + (Math.random() - 0.5) * 0.1;

            // Entrega próxima da coleta (até 10km)
            const deliveryLat = pickupLat + (Math.random() - 0.5) * 0.2;
            const deliveryLng = pickupLng + (Math.random() - 0.5) * 0.2;

            await pool.query(`
                UPDATE marketplace_orders 
                SET pickup_lat = $1, pickup_lng = $2, 
                    delivery_lat = $3, delivery_lng = $4
                WHERE id = $5
            `, [pickupLat, pickupLng, deliveryLat, deliveryLng, order.id]);

            updatedCount++;
            process.stdout.write('.');
        }

        console.log(`\n✅ Sucesso! ${updatedCount} entregas atualizadas com coordenadas GPS.`);
        console.log('🚀 Agora você pode abrir o mapa e ver os pins!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao rodar seed de GPS:', error);
        process.exit(1);
    }
};

seedGps();
