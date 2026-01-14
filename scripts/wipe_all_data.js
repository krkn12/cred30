
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../packages/backend/.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function safeWipe() {
    console.log('🛡️  INICIANDO WIPE SEGURO (GRANULAR) 🛡️');

    // Lista de tabelas para limpar
    const tables = [
        'marketplace_orders',
        'loan_installments', // Antes de loans
        'loans',
        'transactions',
        'quotas',
        'notifications',
        'access_logs',
        'support_tickets',
        'marketplace_listings'
    ];

    // 1. TRUNCATE TABELAS (Um por um)
    for (const table of tables) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN'); // Transação por tabela
            // Check if exists
            const exists = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name = $1", [table]);
            if (exists.rows.length > 0) {
                // Tenta TRUNCATE CASCADE
                await client.query(`TRUNCATE TABLE ${table} CASCADE`);
                console.log(`✅ Table ${table} truncated.`);
            } else {
                console.log(`⚠️ Table ${table} not found.`);
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            console.log(`❌ Failed to truncate ${table}: ${e.message}`);
        } finally {
            client.release();
        }
    }

    const clientUsers = await pool.connect();

    // 2. UPDATE Balance
    try {
        await clientUsers.query('BEGIN');
        await clientUsers.query('UPDATE users SET balance = 0::numeric');
        await clientUsers.query('COMMIT');
        console.log('✅ Users Balance reset to 0.');
    } catch (e) {
        await clientUsers.query('ROLLBACK');
        console.log('❌ Failed to reset Balance:', e.message);
    }

    // 3. UPDATE Score
    try {
        await clientUsers.query('BEGIN');
        await clientUsers.query('UPDATE users SET score = 500::text'); // Score is sometimes text? Check schema. Try int/varchar casting.
        // Assuming varchar if it's stored as text in DB, or numeric. 
        // Best to use '500'.
        await clientUsers.query('COMMIT');
        console.log('✅ Users Score reset to 500.');
    } catch (e) {
        await clientUsers.query('ROLLBACK');
        console.log('❌ Failed to reset Score:', e.message);
    }

    // 4. Update Flags
    try {
        await clientUsers.query('BEGIN');
        await clientUsers.query('UPDATE users SET is_under_duress = FALSE');
        await clientUsers.query('COMMIT');
        console.log('✅ Duress Flag reset.');
    } catch (e) {
        await clientUsers.query('ROLLBACK');
        console.log('❌ Failed to reset Duress:', e.message);
    }

    try {
        await clientUsers.query('BEGIN');
        await clientUsers.query('UPDATE users SET last_deposit_at = NULL');
        await clientUsers.query('COMMIT');
        console.log('✅ Last Deposit reset.');
    } catch (e) {
        await clientUsers.query('ROLLBACK');
        console.log('❌ Failed to reset Last Deposit:', e.message);
    }

    // 5. System Config
    try {
        await clientUsers.query('BEGIN');
        await clientUsers.query(`
            UPDATE system_config 
            SET system_balance = 0,
                profit_pool = 0,
                total_loan_fund = 0,
                reserve_fund = 0,
                total_owner_profit = 0
        `);
        await clientUsers.query('COMMIT');
        console.log('✅ System Config reset.');
    } catch (e) {
        await clientUsers.query('ROLLBACK');
        console.log('⚠️ Failed to reset System Config:', e.message);
    }

    clientUsers.release();
    pool.end();
}

safeWipe();
