
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();

        const data = {};

        // 1. Usuários
        const users = await client.query('SELECT id, name, email, balance, score, membership_type, is_verified FROM users ORDER BY id');
        data.users = users.rows;

        // 2. Transações
        const transactions = await client.query('SELECT id, user_id, type, amount, status, description, created_at FROM transactions ORDER BY created_at DESC');
        data.transactions = transactions.rows;

        // 3. Cotas (Participações)
        const quotas = await client.query('SELECT id, user_id, purchase_price, current_value, value, status, purchase_date FROM quotas ORDER BY id');
        data.quotas = quotas.rows;

        // 4. Empréstimos
        const loans = await client.query('SELECT id, user_id, amount, interest_rate, total_repayment, status, created_at FROM loans ORDER BY id');
        data.loans = loans.rows;

        // 5. Configuração do Sistema (Reservas)
        const config = await client.query('SELECT * FROM system_config');
        data.system_config = config.rows;

        console.log(JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Erro na extração:', err.message);
    } finally {
        await client.end();
    }
}
run();
