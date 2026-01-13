const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function debug() {
    try {
        // Buscar TODOS os loans do user 31
        const res = await pool.query(`
            SELECT l.id, l.status, l.total_repayment,
                   COALESCE((SELECT SUM(CAST(amount AS NUMERIC)) FROM loan_installments WHERE loan_id = l.id), 0) as total_paid
            FROM loans l 
            WHERE l.user_id = 31
            ORDER BY l.id DESC
        `);

        for (const r of res.rows) {
            const remaining = parseFloat(r.total_repayment) - parseFloat(r.total_paid);
            console.log(JSON.stringify({
                id: r.id,
                status: r.status,
                total_repayment: parseFloat(r.total_repayment).toFixed(2),
                total_paid: parseFloat(r.total_paid).toFixed(2),
                remaining: remaining.toFixed(2),
                needs_fix: remaining <= 0.10 && !['PAID', 'REJECTED'].includes(r.status)
            }));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

debug();
