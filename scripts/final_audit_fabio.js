
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();

        const userId = 3; // Fabio
        const u = await client.query('SELECT name, balance, cpf, phone, pix_key FROM users WHERE id = $1', [userId]);
        const q = await client.query('SELECT purchase_price, current_value FROM quotas WHERE user_id = $1', [userId]);
        const l = await client.query('SELECT amount, metadata FROM loans WHERE user_id = $1', [userId]);
        const t = await client.query('SELECT type, amount, status FROM transactions WHERE user_id = $1 ORDER BY created_at ASC', [userId]);

        console.log('--- AUDITORIA FABIO (ID 3) ---');
        console.log('User:', JSON.stringify(u.rows[0]));
        console.log('Quotas Counts:', q.rows.length);
        console.log('Quotas Details:', JSON.stringify(q.rows));
        console.log('Loans:', JSON.stringify(l.rows));
        console.log('Transactions Count:', t.rows.length);
        console.log('Transactions Flow:', JSON.stringify(t.rows));

        const balance = parseFloat(u.rows[0].balance);
        if (balance === 0) {
            console.log('✅ SUCESSO: Saldo está em R$ 0,00 conforme o fluxo de saque.');
        } else {
            console.error('❌ ERRO: Saldo inesperado:', balance);
        }

    } catch (err) {
        console.error('Erro na auditoria:', err.message);
    } finally {
        await client.end();
    }
}
run();
