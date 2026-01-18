
const { Client } = require('pg');

async function runReset() {
    const url = 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require';
    const client = new Client({ connectionString: url });

    try {
        await client.connect();

        // Literal ID to avoid parameter issues on Windows/Neon
        console.log('Final Reset for User 1...');
        await client.query('DELETE FROM marketplace_orders WHERE buyer_id = 1 OR seller_id = 1');
        await client.query('DELETE FROM loans WHERE user_id = 1');
        await client.query('DELETE FROM quotas WHERE user_id = 1');
        await client.query('DELETE FROM transactions WHERE user_id = 1');

        await client.query("UPDATE users SET balance = 0, score = 0, xp = 0, level = 1, ad_points = 0, is_verified = false, membership_type = 'NORMAL' WHERE id = 1");

        console.log('✅ SUCCESS: User 1 is at absolute zero.');

        const res = await client.query('SELECT name, balance, score, ad_points FROM users WHERE id = 1');
        console.log('Audit Josias:', res.rows[0]);

    } catch (err) {
        console.error('❌ Final attempt failed:', err.message);
    } finally {
        await client.end();
    }
}

runReset();
