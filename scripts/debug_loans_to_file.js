const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function debug() {
    try {
        const res = await pool.query(`
            SELECT l.id, l.status, l.total_repayment,
                   COALESCE((SELECT SUM(CAST(amount AS NUMERIC)) FROM loan_installments WHERE loan_id = l.id), 0) as total_paid
            FROM loans l 
            WHERE l.user_id = 31
            ORDER BY l.id DESC
        `);

        const results = res.rows.map(r => {
            const remaining = parseFloat(r.total_repayment) - parseFloat(r.total_paid);
            return {
                id: r.id,
                status: r.status,
                total_repayment: parseFloat(r.total_repayment).toFixed(2),
                total_paid: parseFloat(r.total_paid).toFixed(2),
                remaining: remaining.toFixed(2),
                needs_fix: remaining <= 0.10 && !['PAID', 'REJECTED'].includes(r.status)
            };
        });

        fs.writeFileSync('debug_loans_output.json', JSON.stringify(results, null, 2));
        console.log('Saved to debug_loans_output.json');
        console.log('Total loans:', results.length);
        console.log('Needs fix:', results.filter(r => r.needs_fix).length);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

debug();
