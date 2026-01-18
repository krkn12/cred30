
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();

        const fabioRes = await client.query("SELECT id FROM users WHERE email = 'assm701@gmail.com'");
        if (fabioRes.rows.length === 0) {
            console.error('Fabio não encontrado.');
            process.exit(1);
        }
        const fabioId = fabioRes.rows[0].id;

        console.log(`Ajustando fluxo final para Fabio (ID: ${fabioId})`);

        // 1. Limpar transações anteriores para refazer o fluxo limpo
        await client.query("DELETE FROM transactions WHERE user_id = $1", [fabioId]);
        await client.query("DELETE FROM quotas WHERE user_id = $1", [fabioId]);
        await client.query("DELETE FROM loans WHERE user_id = $1", [fabioId]);

        // 2. Fluxo Financeiro (Balanço Zero)
        // a) Depósito inicial
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, status, description, created_at) 
             VALUES ($1, 'DEPOSIT', 100.00, 'APPROVED', 'Depósito PIX Inicial', NOW() - interval '2 hours')`,
            [fabioId]
        );

        // b) Compra de 2 Cotas (50 cada)
        for (let i = 0; i < 2; i++) {
            await client.query(
                `INSERT INTO quotas (user_id, purchase_price, current_value, value, status, purchase_date, yield_rate) 
                 VALUES ($1, 50.00, 42.00, 42.00, 'ACTIVE', NOW() - interval '1 hour', 0.02)`,
                [fabioId]
            );
            await client.query(
                `INSERT INTO transactions (user_id, type, amount, status, description, created_at) 
                 VALUES ($1, 'BUY_QUOTA', -50.00, 'APPROVED', 'Compra de Participação Cred30', NOW() - interval '50 minutes')`,
                [fabioId]
            );
        }

        // c) Empréstimo de 70 (Aprovado e já Sacado)
        await client.query(
            `INSERT INTO loans (user_id, amount, interest_rate, penalty_rate, total_repayment, installments, status, created_at, due_date) 
             VALUES ($1, 70.00, 0.20, 0.40, 84.00, 1, 'APPROVED', NOW() - interval '40 minutes', NOW() + interval '30 days')`,
            [fabioId]
        );

        // Transação de entrada do empréstimo no saldo
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, status, description, created_at) 
             VALUES ($1, 'LOAN_DISBURSEMENT', 70.00, 'APPROVED', 'Empréstimo Recebido (Entrada em Saldo)', NOW() - interval '35 minutes')`,
            [fabioId]
        );

        // d) Saque dos 70 reais
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, status, description, created_at) 
             VALUES ($1, 'WITHDRAWAL', -70.00, 'APPROVED', 'Saque via PIX (Empréstimo)', NOW() - interval '10 minutes')`,
            [fabioId]
        );

        // 3. Atualizar Dados Cadastrais (Placeholders)
        // Como o Josias não tem os dados, coloco genéricos para ele poder completar depois
        await client.query(
            `UPDATE users SET 
                balance = 0.00, 
                cpf = '00000000000', 
                phone = '00000000000', 
                pix_key = 'pendente@pix.com',
                is_verified = false
             WHERE id = $1`,
            [fabioId]
        );

        console.log('✅ AJUSTE CONCLUÍDO: Fabio com Saldo 0, 2 Cotas (42 resgatáveis) e fluxo de saque registrado.');

    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        await client.end();
    }
}
run();
