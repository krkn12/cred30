"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../packages/backend/src/infrastructure/database/postgresql/connection/pool");
async function wipeDatabase() {
    try {
        console.log("⚠️  STARTING COMPLETE DATABASE WIPE ⚠️");
        console.log("Connecting to database...");
        // Disable foreign key checks momentarily if needed, or just use CASCADE.
        // In Postgres, TRUNCATE ... CASCADE is the way.
        const tablesToTruncate = [
            'users',
            'system_config', // Resetting global configs/money pools
            'products', // Resetting affiliate products
            'rate_limit_logs',
            'admin_logs'
            // other tables are linked to users and will be cleared by CASCADE on users
        ];
        console.log(`Truncating tables: ${tablesToTruncate.join(', ')} (and cascading relations)...`);
        // We run in a transaction to ensure all or nothing
        const client = await pool_1.pool.connect();
        try {
            await client.query('BEGIN');
            // TRUNCATE users CASCADE will clear:
            // - quotas
            // - loans -> loan_installments
            // - transactions
            // - marketplace_listings -> marketplace_orders
            // - referral_codes
            // - notifications (if exists and linked)
            // - etc.
            for (const table of tablesToTruncate) {
                // Check if table exists before truncating to avoid errors
                const check = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    );
                `, [table]);
                if (check.rows[0].exists) {
                    await client.query(`TRUNCATE TABLE ${table} CASCADE`);
                    console.log(`✅ Truncated ${table} CASCADE`);
                }
                else {
                    console.log(`⚠️ Table ${table} does not exist, skipping.`);
                }
            }
            // Optional: Re-seed initial system config if necessary?
            // For now, "zerado" implies empty. The app presumably handles empty config by creating defaults or we might want to insert a default row?
            // The user said "zerado", checking pool.ts it creates table but I didn't see insert default.
            // Let's assume the app initializes it if missing or I should insert a blank one.
            // Let's just leave it empty.
            await client.query('COMMIT');
            console.log("\n✨ DATABASE SUCCESSFULLY WIPED. ✨");
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error("CRITICAL ERROR WIPING DB:", error);
    }
    finally {
        setTimeout(() => process.exit(0), 1000);
    }
}
wipeDatabase();
