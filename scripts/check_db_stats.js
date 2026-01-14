
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../packages/backend/.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkStats() {
    const client = await pool.connect();
    try {
        console.log('📊 VERIFICAÇÃO DE DADOS (PÓS-WIPE) 📊');

        const resTrans = await client.query('SELECT COUNT(*) FROM transactions');
        console.log(`Transações: ${resTrans.rows[0].count}`);

        const resLoans = await client.query('SELECT COUNT(*) FROM loans');
        console.log(`Empréstimos: ${resLoans.rows[0].count}`);

        const resInstallments = await client.query('SELECT COUNT(*) FROM loan_installments');
        console.log(`Parcelas: ${resInstallments.rows[0].count}`);

        const resQuotas = await client.query('SELECT COUNT(*) FROM quotas');
        console.log(`Cotas: ${resQuotas.rows[0].count}`);

        const resOrders = await client.query('SELECT COUNT(*) FROM marketplace_orders');
        console.log(`Pedidos Marketplace: ${resOrders.rows[0].count}`);

        const resUsers = await client.query('SELECT COUNT(*) FROM users');
        console.log(`Total Usuários (Contas Mantidas): ${resUsers.rows[0].count}`);

        const resBalance = await client.query('SELECT SUM(balance) as total_balance FROM users');
        console.log(`Saldo Total Somado de Todos Usuários: R$ ${resBalance.rows[0].total_balance || 0}`);

        const resAdmin = await client.query("SELECT id, name, balance, score, role FROM users WHERE role = 'ADMIN' OR email LIKE '%admin%' LIMIT 1");
        if (resAdmin.rows.length > 0) {
            console.log('Admin Status:', resAdmin.rows[0]);
        }

    } catch (e) {
        console.error('Erro:', e);
    } finally {
        client.release();
        pool.end();
    }
}

checkStats();
