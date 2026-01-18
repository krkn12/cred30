
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });
    const JOSIAS_ID = 1;

    await client.connect();
    console.log('--- RESET ABSOLUTO: JOSIAS ---');

    try {
        // Obter colunas para não dar erro de coluna inexistente
        const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        const columns = colRes.rows.map(r => r.column_name);

        const updates = {
            balance: 0,
            score: 0,
            membership_type: 'NORMAL',
            is_verified: false,
            xp: 0,
            level: 1,
            total_borrowed: 0,
            total_repaid: 0,
            seller_rating: 0,
            seller_total_sales: 0,
            seller_total_reviews: 0,
            last_deposit_at: null,
            security_lock_until: null
        };

        let activeUpdates = [];
        for (let col in updates) {
            if (columns.includes(col)) {
                let val = updates[col];
                activeUpdates.push(`${col} = ${val === null ? 'NULL' : (typeof val === 'string' ? `'${val}'` : val)}`);
            }
        }

        if (activeUpdates.length > 0) {
            await client.query(`UPDATE users SET ${activeUpdates.join(', ')} WHERE id = $1`, [JOSIAS_ID]);
            console.log('✅ USUÁRIO JOSIAS RESETADO: ZERO ABSOLUTO.');
        }

    } catch (err) {
        console.error('Erro no reset:', err.message);
    } finally {
        await client.end();
    }
}
run();
