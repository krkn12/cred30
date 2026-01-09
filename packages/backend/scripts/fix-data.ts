import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('🔧 CORREÇÃO DOS DADOS DO BANCO\n');

        // 1. Corrigir pedido onde comprador = entregador
        console.log('1️⃣ Corrigindo pedidos onde comprador = entregador...');
        const badOrders = await client.query(`
            SELECT id, buyer_id, courier_id FROM marketplace_orders WHERE buyer_id = courier_id
        `);

        if (badOrders.rows.length > 0) {
            // Pegar um entregador válido (não é o comprador nem vendedor)
            for (const order of badOrders.rows) {
                const newCourier = await client.query(`
                    SELECT id FROM users 
                    WHERE id != $1 AND id NOT IN (SELECT seller_id FROM marketplace_orders WHERE id = $2)
                    LIMIT 1
                `, [order.buyer_id, order.id]);

                if (newCourier.rows.length > 0) {
                    await client.query(`UPDATE marketplace_orders SET courier_id = $1 WHERE id = $2`,
                        [newCourier.rows[0].id, order.id]);
                    console.log(`   ✅ Pedido #${order.id}: Entregador alterado de ${order.courier_id} para ${newCourier.rows[0].id}`);
                }
            }
        } else {
            console.log('   ✅ Nenhum pedido com problema encontrado.');
        }

        // 2. Criar transações para os pagamentos
        console.log('\n2️⃣ Criando histórico de transações...');

        const completedOrders = await client.query(`
            SELECT o.id, o.seller_id, o.courier_id, o.seller_amount, o.delivery_fee, o.fee_amount,
                   l.title, seller.name as seller_name, courier.name as courier_name
            FROM marketplace_orders o
            JOIN marketplace_listings l ON o.listing_id = l.id
            LEFT JOIN users seller ON o.seller_id = seller.id
            LEFT JOIN users courier ON o.courier_id = courier.id
            WHERE o.status = 'COMPLETED'
        `);

        for (const order of completedOrders.rows) {
            const sellerAmount = parseFloat(order.seller_amount || 0);
            const courierAmount = parseFloat(order.delivery_fee || 0) * 0.90;
            const feeAmount = parseFloat(order.fee_amount || 0);

            // Transação do Vendedor
            if (sellerAmount > 0) {
                await client.query(`
                    INSERT INTO transactions (user_id, type, amount, description, status, created_at)
                    VALUES ($1, 'MARKET_SALE', $2, $3, 'APPROVED', NOW())
                    ON CONFLICT DO NOTHING
                `, [order.seller_id, sellerAmount, `Venda: ${order.title}`]);
            }

            // Transação do Entregador
            if (order.courier_id && courierAmount > 0) {
                await client.query(`
                    INSERT INTO transactions (user_id, type, amount, description, status, created_at)
                    VALUES ($1, 'LOGISTIC_EARN', $2, $3, 'APPROVED', NOW())
                    ON CONFLICT DO NOTHING
                `, [order.courier_id, courierAmount, `Entrega: ${order.title}`]);
            }

            console.log(`   ✅ Pedido #${order.id}: Transações criadas`);
        }

        // 3. Creditar o sistema com as taxas
        console.log('\n3️⃣ Creditando taxas ao sistema...');

        const totalFees = await client.query(`
            SELECT COALESCE(SUM(fee_amount), 0) as marketplace_fees,
                   COALESCE(SUM(delivery_fee * 0.10), 0) as logistics_fees
            FROM marketplace_orders WHERE status = 'COMPLETED'
        `);

        const mktFees = parseFloat(totalFees.rows[0].marketplace_fees);
        const logFees = parseFloat(totalFees.rows[0].logistics_fees);

        // 50% das taxas para profit_pool (cotistas), 50% para sistema
        const profitShare = (mktFees + logFees) * 0.5;
        const systemShare = (mktFees + logFees) * 0.5;

        await client.query(`
            UPDATE system_config 
            SET profit_pool = profit_pool + $1,
                system_balance = system_balance + $2
        `, [profitShare, systemShare]);

        console.log(`   ✅ Profit Pool (Cotistas): +R$ ${profitShare.toFixed(2)}`);
        console.log(`   ✅ System Balance: +R$ ${systemShare.toFixed(2)}`);

        // 4. Relatório final
        console.log('\n📊 SALDOS ATUALIZADOS:');
        const users = await client.query(`SELECT id, name, balance FROM users ORDER BY id`);
        for (const u of users.rows) {
            console.log(`   ${u.name}: R$ ${parseFloat(u.balance).toFixed(2)}`);
        }

        console.log('\n💰 TRANSAÇÕES CRIADAS:');
        const txns = await client.query(`
            SELECT u.name, t.type, t.amount, t.description 
            FROM transactions t 
            JOIN users u ON t.user_id = u.id 
            ORDER BY t.created_at DESC LIMIT 10
        `);
        for (const t of txns.rows) {
            console.log(`   ${t.name} | ${t.type} | R$ ${parseFloat(t.amount).toFixed(2)} | ${t.description}`);
        }

        console.log('\n⚙️ SISTEMA:');
        const config = await client.query(`SELECT profit_pool, system_balance FROM system_config LIMIT 1`);
        console.log(`   Profit Pool: R$ ${parseFloat(config.rows[0].profit_pool).toFixed(2)}`);
        console.log(`   System Balance: R$ ${parseFloat(config.rows[0].system_balance).toFixed(2)}`);

        console.log('\n🎉 CORREÇÃO CONCLUÍDA!');

    } catch (e) {
        console.error('❌ Erro:', e);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
