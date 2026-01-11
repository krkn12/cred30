require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        const users = await pool.query("SELECT id, name, email, balance, score FROM users");
        console.log('Nomes na base:', users.rows.map(u => u.name));

        const target = users.rows.find(u =>
            u.name.toLowerCase().includes('luiz') ||
            u.name.toLowerCase().includes('luis')
        );

        if (target) {
            console.log(`\nENCONTRADO: ${target.name} (ID: ${target.id})`);
            console.log('Saldo Total:', target.balance);
            console.log('Score:', target.score);

            const qRes = await pool.query("SELECT * FROM quotas WHERE user_id = $1", [target.id]);
            console.log('\nCOTAS:', qRes.rows);

            const dRes = await pool.query("SELECT * FROM deposits WHERE user_id = $1", [target.id]);
            console.log('\nDEPÓSITOS:', dRes.rows);

            const tRes = await pool.query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC", [target.id]);
            console.log('\nTRANSAÇÕES:', tRes.rows);
        } else {
            console.log('Luiz não encontrado.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
