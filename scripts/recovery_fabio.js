
const { Client } = require('pg');
const fs = require('fs');
const bcrypt = require('bcrypt');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();
        console.log('Iniciando RECUPERAÇÃO do Luis Fabio...');

        // 1. Recriar Usuário (Luis Fabio)
        const passwordHash = await bcrypt.hash('fabio123', 10);
        const userRes = await client.query(
            `INSERT INTO users (name, email, password_hash, balance, is_verified, membership_type, score) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            ['luis fabio', 'assm701@gmail.com', passwordHash, 0, true, 'NORMAL', 100]
        );
        const newFabioId = userRes.rows[0].id;
        console.log(`Usuário Luis Fabio recriado com ID: ${newFabioId}`);

        // 2. Repor Empréstimo (R$ 70,00)
        const amount = 70.00;
        const interestRate = 0.20;
        const totalToPay = amount * (1 + interestRate);
        const loanRes = await client.query(
            `INSERT INTO loans (user_id, amount, interest_rate, penalty_rate, total_repayment, installments, status, created_at, due_date) 
             VALUES ($1, $2, $3, $4, $5, 1, 'APPROVED', NOW(), NOW() + interval '30 days') RETURNING id`,
            [newFabioId, amount, interestRate, 0.40, totalToPay]
        );
        console.log(`Empréstimo de R$ 70,00 reposto (ID: ${loanRes.rows[0].id}).`);

        // 3. Repor Transação de Saída (Débito do Pix Manual)
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, status, description, created_at) 
             VALUES ($1, 'LOAN_DISBURSEMENT', $2, 'APPROVED', $3, NOW())`,
            [newFabioId, -amount, 'Empréstimo Recebido (Recuperação de Dados)']
        );
        console.log('Transação de débito R$ 70,00 reposta.');

        console.log('\n✅ RECUPERAÇÃO CONCLUÍDA!');

    } catch (err) {
        console.error('Erro na recuperação:', err.message);
    } finally {
        await client.end();
    }
}
run();
