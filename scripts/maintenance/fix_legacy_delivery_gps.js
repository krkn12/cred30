const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_ODLh9Hdv7eZR@ep-mute-math-ahw4pcdb.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function fixGps() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('--- BUSCANDO ORDENS SEM GPS ---');
        const ordersRes = await pool.query(`
            SELECT 
                o.id, 
                o.listing_id, 
                o.delivery_status,
                l.pickup_lat as l_lat,
                l.pickup_lng as l_lng
            FROM marketplace_orders o
            LEFT JOIN marketplace_listings l ON o.listing_id = l.id
            WHERE (o.pickup_lat IS NULL OR o.pickup_lng IS NULL)
            AND o.delivery_status NOT IN ('COMPLETED', 'CANCELLED')
        `);

        console.log(`Encontradas ${ordersRes.rows.length} ordens para corrigir.`);

        for (const row of ordersRes.rows) {
            console.log(`Corrigindo Ordem #${row.id} (Listing #${row.listing_id})...`);

            // Tentar usar coordenadas da listagem se existirem
            let lat = row.l_lat;
            let lng = row.l_lng;

            // Fallback para Belém/PA se a listagem também não tiver
            if (!lat || !lng) {
                console.log(`Aviso: Listing #${row.listing_id} também sem GPS. Usando fallback Belém/PA.`);
                lat = -1.4557;
                lng = -48.4902;
            }

            await pool.query(
                `UPDATE marketplace_orders 
                 SET pickup_lat = $1, pickup_lng = $2, 
                     delivery_lat = $1 + 0.01, delivery_lng = $2 + 0.01
                 WHERE id = $3`,
                [lat, lng, row.id]
            );

            // Também atualizar a listagem se ela estiver nula, para futuros pedidos
            await pool.query(
                `UPDATE marketplace_listings 
                 SET pickup_lat = $1, pickup_lng = $2
                 WHERE id = $3 AND (pickup_lat IS NULL OR pickup_lng IS NULL)`,
                [lat, lng, row.listing_id]
            );

            console.log(`✅ Ordem #${row.id} atualizada com sucesso!`);
        }

        console.log('--- PROCESSO CONCLUÍDO ---');
    } catch (err) {
        console.error('Erro na manutenção:', err);
    } finally {
        await pool.end();
    }
}

fixGps();
