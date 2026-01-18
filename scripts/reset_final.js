
const { Client } = require('pg');

async function runReset() {
    const url = 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require';
    const client = new Client({ connectionString: url });

    try {
        await client.connect();
        console.log('Connected to DB');

        const userId = 1;
        const tablesToClean = [
            { table: 'marketplace_orders', query: 'DELETE FROM marketplace_orders WHERE buyer_id = $1 OR seller_id = $2', params: [userId, userId] },
            { table: 'loans', query: 'DELETE FROM loans WHERE user_id = $1', params: [userId] },
            { table: 'quotas', query: 'DELETE FROM quotas WHERE user_id = $1', params: [userId] },
            { table: 'transactions', query: 'DELETE FROM transactions WHERE user_id = $1', params: [userId] }
        ];

        console.log('Cleaning user 1 dependents...');
        for (const t of tablesToClean) {
            try {
                await client.query(t.query, t.params);
                console.log(`✅ Cleaned ${t.table}`);
            } catch (e) {
                console.warn(`⚠️ Could not clean ${t.table}: ${e.message}`);
            }
        }

        // Reset user record
        console.log('Resetting user 1 record...');
        try {
            await client.query(`
                UPDATE users 
                SET balance = 0, 
                    score = 0, 
                    xp = 0, 
                    level = 1, 
                    ad_points = 0, 
                    is_verified = false, 
                    membership_type = 'NORMAL' 
                WHERE id = $1
            `, [userId]);
            console.log('✅ User 1 record updated to zero');
        } catch (e) {
            console.error(`❌ Failed to reset user 1 record: ${e.message}`);
        }

        // Audit Final State
        const res = await client.query('SELECT name, balance, score, ad_points FROM users WHERE id = $1', [userId]);
        console.log('Audit Josias:', res.rows[0]);

        const fabio = await client.query('SELECT name, balance FROM users WHERE id = 3');
        const fabioQuotas = await client.query('SELECT COUNT(*) FROM quotas WHERE user_id = 3');
        console.log('Audit Fabio:', { ...fabio.rows[0], quotas: fabioQuotas.rows[0].count });

    } catch (err) {
        console.error('❌ Error during connection/audit:', err.message);
    } finally {
        await client.end();
    }
}

runReset();
