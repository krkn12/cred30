
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();

        // Reset Total Josias (ID 1)
        await client.query(`
            UPDATE users SET 
                balance = 0.00,
                score = 0,
                xp = 0,
                level = 1,
                ad_points = 0,
                membership_type = 'NORMAL',
                is_verified = false,
                referral_count = 0,
                completed_missions = 0
            WHERE id = 1
        `);

        // Limpar histórico de transações dele
        await client.query("DELETE FROM transactions WHERE user_id = 1");

        console.log('✅ Josias (ID 1) resetado ao ZERO ABSOLUTO (Farm Points, XP, Score, Saldo).');

    } catch (err) {
        console.error('Erro no reset:', err.message);
    } finally {
        await client.end();
    }
}
run();
