import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('🔧 Script de Teste: Saldo e Confirmação de Entregas\n');

        // 1. Dar saldo para todos os usuários de teste
        console.log('💰 Adicionando saldo aos usuários...');
        await client.query(`
            UPDATE users SET balance = balance + 500 WHERE email LIKE '%belem%' OR email LIKE '%test%'
        `);

        const usersResult = await client.query(`SELECT id, name, email, balance FROM users ORDER BY id`);
        console.log('👥 Usuários atualizados:');
        for (const u of usersResult.rows) {
            console.log(`   - ${u.name} (${u.email}): R$ ${parseFloat(u.balance).toFixed(2)}`);
        }

        // 2. Buscar entregas pendentes de confirmação
        const pendingOrders = await client.query(`
            SELECT o.id, o.seller_id, o.courier_id, o.seller_amount, o.delivery_fee, o.status, o.delivery_status,
                   l.title, seller.name as seller_name, courier.name as courier_name
            FROM marketplace_orders o
            JOIN marketplace_listings l ON o.listing_id = l.id
            LEFT JOIN users seller ON o.seller_id = seller.id
            LEFT JOIN users courier ON o.courier_id = courier.id
            WHERE o.status != 'COMPLETED' AND o.status != 'CANCELLED'
        `);

        console.log(`\n📦 Processando ${pendingOrders.rows.length} pedidos pendentes...\n`);

        for (const order of pendingOrders.rows) {
            console.log(`🚀 Pedido #${order.id}: ${order.title}`);
            console.log(`   Status atual: ${order.status} / ${order.delivery_status}`);

            // Simular entregador se não tiver
            let courierId = order.courier_id;
            if (!courierId) {
                // Pegar um usuário qualquer como entregador
                const courierResult = await client.query(`SELECT id FROM users WHERE id != $1 LIMIT 1`, [order.seller_id]);
                if (courierResult.rows.length > 0) {
                    courierId = courierResult.rows[0].id;
                    await client.query(`UPDATE marketplace_orders SET courier_id = $1 WHERE id = $2`, [courierId, order.id]);
                    console.log(`   ⚡ Entregador atribuído: ID ${courierId}`);
                }
            }

            // Finalizar pedido
            await client.query(`
                UPDATE marketplace_orders 
                SET status = 'COMPLETED', delivery_status = 'COMPLETED', updated_at = NOW() 
                WHERE id = $1
            `, [order.id]);

            // Pagar vendedor
            const sellerAmount = parseFloat(order.seller_amount || 0);
            if (sellerAmount > 0) {
                await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [sellerAmount, order.seller_id]);
                console.log(`   💰 Vendedor recebeu: R$ ${sellerAmount.toFixed(2)}`);
            }

            // Pagar entregador (90% do frete)
            const deliveryFee = parseFloat(order.delivery_fee || 0);
            if (courierId && deliveryFee > 0) {
                const courierEarnings = deliveryFee * 0.90;
                await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [courierEarnings, courierId]);
                console.log(`   🛵 Entregador recebeu: R$ ${courierEarnings.toFixed(2)}`);
            }

            console.log(`   ✅ Pedido FINALIZADO!\n`);
        }

        // 3. Mostrar saldos finais
        console.log('📊 Saldos finais:');
        const finalBalances = await client.query(`SELECT id, name, balance FROM users ORDER BY id`);
        for (const u of finalBalances.rows) {
            console.log(`   - ${u.name}: R$ ${parseFloat(u.balance).toFixed(2)}`);
        }

        console.log('\n🎉 SCRIPT EXECUTADO COM SUCESSO!');

    } catch (e) {
        console.error('❌ Erro:', e);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
