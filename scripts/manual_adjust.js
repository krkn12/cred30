
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    let dbUrl;
    try {
        const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
        const match = envContent.match(/DATABASE_URL=(.+)/);
        if (!match) throw new Error('DATABASE_URL não encontrada no .env');
        dbUrl = match[1].trim();
    } catch (e) {
        console.error('Erro ao ler .env:', e.message);
        process.exit(1);
    }

    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();
        console.log('Conectado ao NeonDB.');

        // 1. Localizar usuários
        const usersRes = await client.query("SELECT id, name FROM users WHERE id IN (1, 2)");
        console.log('Usuários:', usersRes.rows);

        const luiFabio = usersRes.rows.find(u => u.id === 2);
        const josias = usersRes.rows.find(u => u.id === 1);

        if (luiFabio) {
            console.log('Ajustando Empréstimo de Lui Fabio (ID 2)');
            const amount = 70.00;
            const interestRate = 0.20;
            const penaltyRate = 0.40;
            const totalToPay = amount * (1 + interestRate);

            // Inserir Empréstimo (Colunas confirmadas: user_id, amount, interest_rate, penalty_rate, total_repayment, installments, status, created_at, due_date)
            const loanRes = await client.query(
                `INSERT INTO loans (user_id, amount, interest_rate, penalty_rate, total_repayment, installments, status, created_at, due_date) 
                 VALUES ($1, $2, $3, $4, $5, 1, 'APPROVED', NOW(), NOW() + interval '30 days') RETURNING id`,
                [luiFabio.id, amount, interestRate, penaltyRate, totalToPay]
            );
            console.log('Empréstimo R$ 70,00 registrado. ID:', loanRes.rows[0].id);

            // Inserir Transação (Colunas confirmadas: user_id, type, amount, status, description, created_at)
            await client.query(
                `INSERT INTO transactions (user_id, type, amount, status, description, created_at) 
                 VALUES ($1, 'LOAN_DISBURSEMENT', $2, 'APPROVED', $3, NOW())`,
                [luiFabio.id, -amount, 'Apoio Mútuo Pago via Pix (Ajuste Manual - Josias)']
            );
            console.log('Transação de saída de R$ 70,00 registrada.');
        }

        if (josias) {
            // Josias já foi ajustado no passo anterior, mas vou reforçar se necessário
            console.log('Reforçando Josias como PRO/Verificado...');
            await client.query(
                `UPDATE users SET membership_type = 'PRO', is_verified = true, score = GREATEST(score, 1000) WHERE id = 1`
            );
        }

    } catch (err) {
        console.error('Erro na execução:', err.message);
    } finally {
        await client.end();
    }
}

run();
