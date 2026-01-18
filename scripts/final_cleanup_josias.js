
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runFinalCleanup() {
    const envPath = 'c:\\Users\\josia\\Desktop\\projetos\\cred30\\packages\\backend\\.env';
    const env = fs.readFileSync(envPath, 'utf8');
    const dbUrlMatch = env.match(/DATABASE_URL=(.+)/);
    const dbUrl = dbUrlMatch[1].trim();

    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    try {
        const id = 1;
        console.log('--- STARTING FINAL CLEANUP & RESET (USER 1) ---');

        // Clean Dependencies
        console.log('Deleting marketplace orders...');
        await client.query("DELETE FROM marketplace_orders WHERE buyer_id = $1 OR seller_id = $2", [id, id]);

        console.log('Deleting loans...');
        await client.query("DELETE FROM loans WHERE user_id = $1", [id]);

        console.log('Deleting quotas...');
        await client.query("DELETE FROM quotas WHERE user_id = $1", [id]);

        console.log('Deleting transactions...');
        await client.query("DELETE FROM transactions WHERE user_id = $1", [id]);

        console.log('Deleting scores...');
        await client.query("DELETE FROM user_scores WHERE user_id = $1", [id]);

        // Reset User
        console.log('Updating user record to absolute zero...');
        await client.query("UPDATE users SET balance = 0, score = 0, xp = 0, level = 1, ad_points = 0, membership_type = 'NORMAL', is_verified = false WHERE id = $1", [id]);

        // Audit Fabio
        console.log('Verifying Fabio (ID 3)...');
        const fabio = await client.query("SELECT balance FROM users WHERE id = 3");
        const fabioQuotas = await client.query("SELECT COUNT(*) FROM quotas WHERE user_id = 3");

        console.log('RESULTS:');
        console.log('Josias:', (await client.query("SELECT balance, ad_points, score FROM users WHERE id = 1")).rows[0]);
        console.log('Fabio:', { balance: fabio.rows[0].balance, quotas: fabioQuotas.rows[0].count });

        console.log('--- CLEANUP COMPLETED ---');
    } catch (err) {
        console.error('Cleanup failed:', err);
    } finally {
        await client.end();
    }
}

runFinalCleanup();
