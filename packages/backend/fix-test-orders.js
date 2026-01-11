const { Client } = require('pg');

const c = new Client('postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
    await c.connect();

    console.log('🔄 Atualizando ordens de teste...');

    // Atualiza status para o que o backend espera
    const res = await c.query(`
        UPDATE marketplace_orders 
        SET status = 'WAITING_SHIPPING' 
        WHERE delivery_status = 'AVAILABLE' 
        RETURNING id, status, delivery_status
    `);

    if (res.rows.length > 0) {
        console.log('✅ Ordens atualizadas:');
        res.rows.forEach(r => console.log(`  - ID: ${r.id}, Status: ${r.status}, Delivery Status: ${r.delivery_status}`));
    } else {
        console.log('⚠️ Nenhuma ordem encontrada com status AVAILABLE.');
    }

    await c.end();
}

main().catch(e => console.log('❌ Erro:', e.message));
