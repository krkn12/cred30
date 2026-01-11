require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { getCreditAnalysis } = require('../packages/backend/src/application/services/credit-analysis.service');

async function test() {
    try {
        const userId = 16;
        const creditAnalysis = await getCreditAnalysis(pool, userId);

        const activeLoansResult = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM loans 
             WHERE user_id = $1 AND status IN ('APPROVED', 'PAYMENT_PENDING', 'PENDING')`,
            [userId]
        );
        const activeDebt = parseFloat(activeLoansResult.rows[0].total);
        const remainingLimit = Math.max(0, creditAnalysis.limit - activeDebt);

        const response = {
            success: true,
            data: {
                totalLimit: creditAnalysis.limit,
                activeDebt: activeDebt,
                remainingLimit: remainingLimit,
                analysis: creditAnalysis
            }
        };

        console.log(JSON.stringify(response, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
test();
