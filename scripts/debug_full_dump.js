require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function debugFull() {
    try {
        console.log('\n=== ALL TRANSACTIONS ===');
        const tx = await pool.query("SELECT id, user_id, type, amount, status, metadata FROM transactions ORDER BY id DESC");
        tx.rows.forEach(r => {
            console.log(`[${r.id}] ${r.type} | R$ ${r.amount} | ${r.status} | Meta: ${JSON.stringify(r.metadata)}`);
        });

        console.log('\n=== ALL LOANS ===');
        const loans = await pool.query("SELECT * FROM loans");
        loans.rows.forEach(r => {
            console.log(`Loan [${r.id}] User: ${r.user_id} | Amount: ${r.amount} | Status: ${r.status}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

debugFull();
