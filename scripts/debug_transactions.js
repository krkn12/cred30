require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function queryDB() {
    try {
        console.log('\n=== ULTIMAS 30 TRANSACOES ===\n');

        const txRes = await pool.query(`
            SELECT id, user_id, type, amount, status, description, created_at 
            FROM transactions 
            ORDER BY created_at DESC 
            LIMIT 30
        `);

        txRes.rows.forEach(row => {
            console.log(`ID: ${row.id} | User: ${row.user_id} | Type: ${row.type} | R$ ${parseFloat(row.amount).toFixed(2)} | ${row.status} | ${row.description || '-'}`);
        });

        console.log('\n=== RESUMO POR TIPO ===\n');

        const summaryRes = await pool.query(`
            SELECT type, COUNT(*) as count, SUM(amount) as total
            FROM transactions
            WHERE status = 'APPROVED'
            GROUP BY type
            ORDER BY total DESC
        `);

        summaryRes.rows.forEach(row => {
            console.log(`${row.type}: ${row.count} transações | Total: R$ ${parseFloat(row.total || 0).toFixed(2)}`);
        });

        console.log('\n=== VOLUME TOTAL (Fiscal) ===\n');

        const volumeRes = await pool.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'DEPOSIT' AND status = 'APPROVED' THEN amount ELSE 0 END), 0) as depositos,
                COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' AND status = 'APPROVED' THEN amount ELSE 0 END), 0) as saques,
                COALESCE(SUM(CASE WHEN type IN ('ORDER_PAYMENT', 'BUY_QUOTA', 'LOAN_REPAYMENT') AND status = 'APPROVED' THEN amount ELSE 0 END), 0) as outros_pagamentos
            FROM transactions
        `);

        const v = volumeRes.rows[0];
        console.log(`Depósitos Aprovados: R$ ${parseFloat(v.depositos).toFixed(2)}`);
        console.log(`Saques Aprovados: R$ ${parseFloat(v.saques).toFixed(2)}`);
        console.log(`Outros Pagamentos: R$ ${parseFloat(v.outros_pagamentos).toFixed(2)}`);

    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        await pool.end();
    }
}

queryDB();
