
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runAudit() {
    const envPath = 'c:\\Users\\josia\\Desktop\\projetos\\cred30\\packages\\backend\\.env';
    const env = fs.readFileSync(envPath, 'utf8');
    const dbUrlMatch = env.match(/DATABASE_URL=(.+)/);
    if (!dbUrlMatch) {
        console.error('DATABASE_URL not found in .env');
        process.exit(1);
    }
    const dbUrl = dbUrlMatch[1].trim();

    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    try {
        console.log('--- STARTING FINAL AUDIT ---');

        // 1. Reset Josias
        await client.query("WITH target AS (SELECT id FROM users WHERE id = 1) UPDATE users SET balance = 0, score = 0, xp = 0, level = 1, ad_points = 0, membership_type = 'NORMAL', is_verified = false FROM target WHERE users.id = target.id");
        await client.query("DELETE FROM transactions WHERE user_id = 1");

        // 2. Fetch Josias
        const josiasRes = await client.query("SELECT id, name, balance, score, ad_points FROM users WHERE id = $1", [1]);
        console.log('JOSIAS STATUS:', josiasRes.rows[0]);

        // 3. Fetch Fabio
        const fabioRes = await client.query("SELECT id, name, balance FROM users WHERE id = 3");
        const quotasRes = await client.query("SELECT COUNT(*) as count, SUM(CAST(current_value AS NUMERIC)) as value FROM quotas WHERE user_id = 3");
        const loansRes = await client.query("SELECT COUNT(*) as count, SUM(CAST(amount AS NUMERIC)) as amount FROM loans WHERE user_id = 3");
        console.log('FABIO STATUS:', {
            user: fabioRes.rows[0],
            quotas: quotasRes.rows[0],
            loans: loansRes.rows[0]
        });

        // 4. System Config
        const configRes = await client.query("SELECT * FROM system_config LIMIT 1");
        console.log('SYSTEM CONFIG:', configRes.rows[0]);

        console.log('--- AUDIT COMPLETED SUCCESSFULLY ---');
    } catch (err) {
        console.error('Audit failed:', err);
    } finally {
        await client.end();
    }
}

runAudit();
