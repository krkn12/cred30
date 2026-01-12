
import { pool } from '../packages/backend/src/infrastructure/database/postgresql/connection/pool';

async function cleanupUsers() {
    try {
        console.log("Connecting to database...");

        // List all users first
        const result = await pool.query("SELECT id, name, email FROM users ORDER BY name");
        console.log("Current Users Count:", result.rows.length);

        const targetNames = ['josias', 'wilha', 'victor', 'gilberto', 'carlos', 'bruno', 'cliente de teste'];
        const keepName = 'fabio';

        // Filter users to delete: Must match target names AND NOT match keepName
        const usersToDelete = result.rows.filter(u => {
            const nameLower = u.name.toLowerCase();
            const emailLower = u.email.toLowerCase();
            const matchesTarget = targetNames.some(t => nameLower.includes(t) || emailLower.includes(t));
            const matchesKeep = nameLower.includes(keepName) || emailLower.includes(keepName);
            return matchesTarget && !matchesKeep;
        });

        console.log(`\nFound ${usersToDelete.length} users to delete.`);

        if (usersToDelete.length === 0) {
            console.log("No matching users found to delete.");
            // List some users to verify we are looking at the right DB
            console.log("Sample users:", result.rows.slice(0, 5).map(u => u.name));
        } else {
            console.log("Deleting the following users:");
            usersToDelete.forEach(u => console.log(`- [${u.id}] ${u.name} (${u.email})`));

            for (const user of usersToDelete) {
                await deleteUserRecursively(user.id);
                console.log(`Successfully deleted user: ${user.name}`);
            }
        }
    } catch (error) {
        console.error("Critical Error during cleanup:", error);
    } finally {
        // Force exit after short delay to ensure logs flush
        setTimeout(() => process.exit(0), 1000);
    }
}

async function deleteUserRecursively(userId: any) {
    try {
        // Safe deletion order (children first)

        // 1. Logs & History
        await pool.query('DELETE FROM rate_limit_logs WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM admin_logs WHERE admin_id = $1', [userId]);

        // 2. Financials & Loans
        // Delete installments for loans owned by this user
        await pool.query(`
            DELETE FROM loan_installments 
            WHERE loan_id IN (SELECT id FROM loans WHERE user_id = $1)
        `, [userId]);
        await pool.query('DELETE FROM loans WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);

        // 3. Marketplace
        // Delete orders where user is buyer, seller, or courier
        await pool.query('DELETE FROM marketplace_orders WHERE buyer_id = $1 OR seller_id = $1 OR courier_id = $1', [userId]);
        // Delete listings by seller
        await pool.query('DELETE FROM marketplace_listings WHERE seller_id = $1', [userId]);

        // 4. Assets & Core
        await pool.query('DELETE FROM quotas WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM referral_codes WHERE created_by = $1', [userId]);

        // 5. The User
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    } catch (e) {
        console.error(`Error deleting user ${userId}:`, e);
        // Continue even if error to try and delete as much as possible? 
        // Or throw to stop? Let's just log and continue to next user if possible, 
        // but if foreign key fails on user delete, it won't be deleted.
    }
}

cleanupUsers();
