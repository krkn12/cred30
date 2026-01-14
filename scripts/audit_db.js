require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function audit() {
    try {
        console.log("--- AUDITORIA DE BANCO DE DADOS ---");

        // 1. Check marketplace_orders columns
        const resOrders = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'marketplace_orders';
        `);
        const orderCols = resOrders.rows.map(r => r.column_name);
        console.log("marketplace_orders has variant_id?", orderCols.includes('variant_id') ? "OK" : "FALHA");

        // 2. Check marketplace_listings columns
        const resListings = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'marketplace_listings';
        `);
        const listCols = resListings.rows.map(r => r.column_name);
        console.log("marketplace_listings has pickup_address?", listCols.includes('pickup_address') ? "OK" : "FALHA");
        console.log("marketplace_listings has required_vehicle?", listCols.includes('required_vehicle') ? "OK" : "FALHA");

        // 3. Check new tables
        const resTables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        `);
        const tables = resTables.rows.map(r => r.table_name);
        console.log("Tabela marketplace_listing_variants existe?", tables.includes('marketplace_listing_variants') ? "OK" : "FALHA");
        console.log("Tabela marketplace_listing_images existe?", tables.includes('marketplace_listing_images') ? "OK" : "FALHA");

        pool.end();
    } catch (e) {
        console.error("Erro na auditoria:", e);
        process.exit(1);
    }
}

audit();
