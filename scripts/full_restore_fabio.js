
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();

        // 1. Achar o Fabio
        const fabioRes = await client.query("SELECT id FROM users WHERE email = 'assm701@gmail.com'");
        if (fabioRes.rows.length === 0) {
            console.error('Fabio não encontrado. Criando...');
            // Se não existir, o script de recuperação anterior falhou ou não rodou.
            process.exit(1);
        }
        const fabioId = fabioRes.rows[0].id;

        console.log(`Restaurando Fabio (ID: ${fabioId})`);

        // 2. Limpar dados parciais para evitar duplicidade (se houver)
        await client.query("DELETE FROM quotas WHERE user_id = $1", [fabioId]);
        await client.query("DELETE FROM transactions WHERE user_id = $1 AND description != 'Empréstimo Recebido (Recuperação de Dados)'", [fabioId]);

        // 3. Inserir Depósito de R$ 100
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, status, description, created_at) 
             VALUES ($1, 'DEPOSIT', 100.00, 'APPROVED', 'Depósito PIX (Restauração)', NOW() - interval '1 hour')`,
            [fabioId]
        );

        // 4. Inserir 2 Cotas (R$ 50 cada)
        const quotaValue = 50.00;
        const quotaShare = 42.00;
        for (let i = 0; i < 2; i++) {
            await client.query(
                `INSERT INTO quotas (user_id, purchase_price, current_value, value, status, purchase_date, yield_rate) 
                 VALUES ($1, $2, $2, $3, 'ACTIVE', NOW() - interval '30 minutes', 0.02)`,
                [fabioId, quotaValue, quotaShare]
            );

            // Transação de compra de cota
            await client.query(
                `INSERT INTO transactions (user_id, type, amount, status, description, created_at) 
                 VALUES ($1, 'BUY_QUOTA', -50.00, 'APPROVED', 'Compra de Participação Cred30', NOW() - interval '25 minutes')`,
                [fabioId]
            );
        }

        // 5. Ajustar Saldo Final
        // Depósito (100) + Empréstimo (70) - 2 Cotas (100) = 70
        await client.query("UPDATE users SET balance = 70.00 WHERE id = $1", [fabioId]);

        console.log('✅ Fabio restaurado: Depósito 100, 2 Cotas (100 total), Empréstimo 70 (já existente). Saldo: 70.');

    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        await client.end();
    }
}
run();
