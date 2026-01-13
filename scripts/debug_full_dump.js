const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function safeQuery(pool, label, query) {
    try {
        console.log(`Querying ${label}...`);
        const res = await pool.query(query);
        console.log(`✅ ${label}: ${res.rowCount} rows`);
        return res.rows;
    } catch (err) {
        console.error(`❌ Error querying ${label}:`, err.message);
        return [];
    }
}

async function dump() {
    try {
        console.log('--- DUMPING FULL DB CONTEXT (ROBUST) ---');

        const users = await safeQuery(pool, 'Users', 'SELECT id, name, email, balance, score, pix_key, created_at, is_admin FROM users');

        const loans = await safeQuery(pool, 'Loans', `
            SELECT l.*, u.name as user_name 
            FROM loans l 
            JOIN users u ON l.user_id = u.id 
            ORDER BY l.created_at DESC
        `);

        // Transaction tables often change schemas, let's keep it simple
        const transactions = await safeQuery(pool, 'Transactions', `
            SELECT t.*, u.name as user_name 
            FROM transactions t 
            JOIN users u ON t.user_id = u.id 
            ORDER BY t.created_at DESC 
            LIMIT 200
        `);

        // Check loan_installments columns blindly first or just select *
        const installments = await safeQuery(pool, 'Installments', 'SELECT * FROM loan_installments');

        const dumpData = {
            timestamp: new Date().toISOString(),
            users,
            loans,
            transactions,
            installments
        };

        const filename = 'full_db_dump.json';
        fs.writeFileSync(filename, JSON.stringify(dumpData, null, 2));
        console.log(`\nDump completo salvo em ${filename}`);

    } catch (err) {
        console.error('Fatal dump error:', err);
    } finally {
        await pool.end();
    }
}

dump();
