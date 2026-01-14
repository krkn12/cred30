const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function debugSchema() {
    console.log("🔍 DEPURANDO SCHEMA...");

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        try {
            console.log("Checking NEW TABLES:");

            console.log("\nmarketplace_listing_variants:");
            const resVar = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'marketplace_listing_variants'
            `);
            console.log(resVar.rows.map(r => r.column_name).join(', '));

            console.log("\nmarketplace_listing_images:");
            const resImg = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'marketplace_listing_images'
            `);
            console.log(resImg.rows.map(r => r.column_name).join(', '));

        } catch (e) {
            console.error("ERROR QUERYING SCHEMA:", e);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("ERROR CONNECTING:", error);
    } finally {
        await pool.end();
    }
}

debugSchema();
