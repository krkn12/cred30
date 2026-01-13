const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function testInsert() {
    console.log('--- Teste de Inserção Direta (Marketplace) ---');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Tentando inserir com listing_id = 13...');
        // Usando o formato real do código do controller
        await pool.query(`
            INSERT INTO marketplace_orders (
                listing_id, buyer_id, seller_id, amount, fee_amount, seller_amount, 
                status, payment_method, delivery_address, contact_phone, delivery_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [13, 1, 1, 10.00, 1.00, 9.00, 'WAITING_SHIPPING', 'BALANCE', 'Teste', '000', 'NONE']);

        console.log('✅ Inserção com sucesso! (ID 13 foi aceito como inteiro)');
    } catch (e) {
        console.error('❌ Falha na inserção:', e.message);
    } finally {
        await pool.end();
    }
}

testInsert();
