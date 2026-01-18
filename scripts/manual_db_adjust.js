
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, 'packages/backend/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();

async function run() {
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    console.log('Conectado ao banco de dados.');

    try {
        // 1. Buscar usuários
        const usersRes = await client.query("SELECT id, name FROM users WHERE name ILIKE '%Lui Fabio%' OR name ILIKE '%Josias%'");
        console.log('Usuários encontrados:', usersRes.rows);

        const luiFabio = usersRes.rows.find(u => u.name.toLowerCase().includes('lui fabio'));
        const josias = usersRes.rows.find(u => u.name.toLowerCase().includes('josias'));

        if (!luiFabio) {
            console.error('Lui Fabio não encontrado!');
        } else {
            // Ajustar empréstimo para Lui Fabio
            // Valor solicitado: 70
            // Valor recebido: 70
            // Juros: 20% (padrão) -> 14 reais
            const amount = 70;
            const interest = 0.2; // 20%
            const totalToPay = amount * (1 + interest);

            // Inserir empréstimo
            const loanRes = await client.query(
                `INSERT INTO loans (user_id, amount, interest_rate, amount_to_disburse, total_repayment, remaining_amount, status, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, 'APPROVED', NOW()) RETURNING id`,
                [luiFabio.id, amount, interest, amount, totalToPay, totalToPay]
            );
            console.log('Empréstimo registrado para Lui Fabio:', loanRes.rows[0].id);

            // Registrar transação de saída (Saída de Pix Manual confirmada pelo Josias)
            await client.query(
                `INSERT INTO transactions (user_id, type, amount, description, status, created_at) 
                 VALUES ($1, 'LOAN_DISBURSEMENT', $2, $3, 'APPROVED', NOW())`,
                [luiFabio.id, -amount, 'Empréstimo Mútuo (Ajuste Manual - Recebido integral)']
            );
            console.log('Transação de saída registrada para Lui Fabio.');
        }

        if (!josias) {
            console.error('Josias não encontrado!');
        } else {
            // Deixar Josias "mais pagada" (PRO, Verificado, High Score)
            await client.query(
                `UPDATE users SET membership_type = 'PRO', is_verified = true, score = COALESCE(score, 0) + 500 WHERE id = $1`,
                [josias.id]
            );
            console.log('Perfil de Josias atualizado (PRO + Verificado + 500 Score).');
        }

    } catch (err) {
        console.error('Erro no script:', err);
    } finally {
        await client.end();
    }
}

run();
