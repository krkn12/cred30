import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('                    📊 RELATÓRIO COMPLETO DO BANCO                ');
        console.log('═══════════════════════════════════════════════════════════════\n');

        // 1. USUÁRIOS
        console.log('👥 USUÁRIOS:');
        console.log('─────────────────────────────────────────────────────────────────');
        const users = await client.query(`SELECT id, name, email, balance, score, phone FROM users ORDER BY id`);
        for (const u of users.rows) {
            console.log(`ID: ${u.id}`);
            console.log(`   Nome: ${u.name}`);
            console.log(`   Email: ${u.email}`);
            console.log(`   Telefone: ${u.phone || 'N/A'}`);
            console.log(`   Saldo: R$ ${parseFloat(u.balance || 0).toFixed(2)}`);
            console.log(`   Score: ${u.score}`);
            console.log('');
        }

        // 2. COTAS
        console.log('\n💎 COTAS:');
        console.log('─────────────────────────────────────────────────────────────────');
        const quotas = await client.query(`
            SELECT q.*, u.name as owner_name 
            FROM quotas q 
            JOIN users u ON q.user_id = u.id 
            ORDER BY q.id
        `);
        if (quotas.rows.length === 0) {
            console.log('   Nenhuma cota cadastrada.\n');
        } else {
            for (const q of quotas.rows) {
                console.log(`ID: ${q.id} | Dono: ${q.owner_name} | Valor: R$ ${parseFloat(q.value || 50).toFixed(2)} | Status: ${q.status}`);
            }
        }

        // 3. EMPRÉSTIMOS
        console.log('\n💳 EMPRÉSTIMOS:');
        console.log('─────────────────────────────────────────────────────────────────');
        const loans = await client.query(`
            SELECT l.*, u.name as borrower_name 
            FROM loans l 
            JOIN users u ON l.user_id = u.id 
            ORDER BY l.id
        `);
        if (loans.rows.length === 0) {
            console.log('   Nenhum empréstimo ativo.\n');
        } else {
            for (const l of loans.rows) {
                console.log(`ID: ${l.id} | Tomador: ${l.borrower_name} | Valor: R$ ${parseFloat(l.amount || 0).toFixed(2)} | Status: ${l.status}`);
            }
        }

        // 4. LISTINGS (PRODUTOS)
        console.log('\n🛍️ PRODUTOS NO MARKETPLACE:');
        console.log('─────────────────────────────────────────────────────────────────');
        const listings = await client.query(`
            SELECT l.*, u.name as seller_name 
            FROM marketplace_listings l 
            JOIN users u ON l.seller_id = u.id 
            ORDER BY l.id
        `);
        for (const l of listings.rows) {
            console.log(`ID: ${l.id} | ${l.title} | R$ ${parseFloat(l.price || 0).toFixed(2)} | Vendedor: ${l.seller_name} | Status: ${l.status}`);
        }

        // 5. PEDIDOS
        console.log('\n📦 PEDIDOS:');
        console.log('─────────────────────────────────────────────────────────────────');
        const orders = await client.query(`
            SELECT o.*, 
                   l.title,
                   seller.name as seller_name,
                   buyer.name as buyer_name,
                   courier.name as courier_name
            FROM marketplace_orders o 
            JOIN marketplace_listings l ON o.listing_id = l.id 
            LEFT JOIN users seller ON o.seller_id = seller.id
            LEFT JOIN users buyer ON o.buyer_id = buyer.id
            LEFT JOIN users courier ON o.courier_id = courier.id
            ORDER BY o.id
        `);
        for (const o of orders.rows) {
            console.log(`\nPedido #${o.id}: ${o.title}`);
            console.log(`   Status: ${o.status} | Entrega: ${o.delivery_status}`);
            console.log(`   Vendedor: ${o.seller_name} (vai receber R$ ${parseFloat(o.seller_amount || 0).toFixed(2)})`);
            console.log(`   Comprador: ${o.buyer_name}`);
            console.log(`   Entregador: ${o.courier_name || 'Não atribuído'}`);
            console.log(`   Frete: R$ ${parseFloat(o.delivery_fee || 0).toFixed(2)}`);
            console.log(`   Coleta: ${o.pickup_address}`);
            console.log(`   Entrega: ${o.delivery_address}`);
        }

        // 6. TRANSAÇÕES
        console.log('\n\n💰 ÚLTIMAS 20 TRANSAÇÕES:');
        console.log('─────────────────────────────────────────────────────────────────');
        const transactions = await client.query(`
            SELECT t.*, u.name 
            FROM transactions t 
            JOIN users u ON t.user_id = u.id 
            ORDER BY t.created_at DESC 
            LIMIT 20
        `);
        if (transactions.rows.length === 0) {
            console.log('   Nenhuma transação registrada.\n');
        } else {
            for (const t of transactions.rows) {
                const sign = t.type.includes('credit') || t.type === 'MARKET_SALE' || t.type === 'LOGISTIC_EARN' ? '+' : '-';
                console.log(`${t.name} | ${t.type} | ${sign}R$ ${parseFloat(t.amount || 0).toFixed(2)} | ${t.description}`);
            }
        }

        // 7. SYSTEM CONFIG
        console.log('\n\n⚙️ CONFIGURAÇÃO DO SISTEMA:');
        console.log('─────────────────────────────────────────────────────────────────');
        const config = await client.query(`SELECT * FROM system_config LIMIT 1`);
        if (config.rows.length > 0) {
            const c = config.rows[0];
            console.log(`   System Balance: R$ ${parseFloat(c.system_balance || 0).toFixed(2)}`);
            console.log(`   Profit Pool (Cotistas): R$ ${parseFloat(c.profit_pool || 0).toFixed(2)}`);
            console.log(`   Investment Reserve: R$ ${parseFloat(c.investment_reserve || 0).toFixed(2)}`);
            console.log(`   Tax Reserve: R$ ${parseFloat(c.total_tax_reserve || 0).toFixed(2)}`);
            console.log(`   Operational Reserve: R$ ${parseFloat(c.total_operational_reserve || 0).toFixed(2)}`);
            console.log(`   Owner Profit: R$ ${parseFloat(c.total_owner_profit || 0).toFixed(2)}`);
            console.log(`   Preço da Cota: R$ ${parseFloat(c.quota_price || 50).toFixed(2)}`);
            console.log(`   Taxa de Juros: ${(parseFloat(c.loan_interest_rate || 0.20) * 100).toFixed(0)}%`);
        }

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('                         FIM DO RELATÓRIO                        ');
        console.log('═══════════════════════════════════════════════════════════════');

    } catch (e) {
        console.error('❌ Erro:', e);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
