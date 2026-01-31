const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
    await client.connect();

    console.log('=== LIMPANDO ENTREGAS ANTIGAS ===');

    // Deletar pedidos antigos (status WAITING_SHIPPING e delivery AVAILABLE)
    const res = await client.query(`
        DELETE FROM marketplace_orders 
        WHERE status = 'WAITING_SHIPPING' AND delivery_status = 'AVAILABLE'
        RETURNING id
    `);

    console.log(`✅ Removidos ${res.rowCount} pedido(s) antigo(s):`);
    res.rows.forEach(r => console.log(`   - ID: ${r.id}`));

    // Verificar se ainda existem pedidos
    const remaining = await client.query('SELECT COUNT(*) as total FROM marketplace_orders');
    console.log(`\n📊 Total de pedidos restantes: ${remaining.rows[0].total}`);

    await client.end();
}

run().catch(console.error);
