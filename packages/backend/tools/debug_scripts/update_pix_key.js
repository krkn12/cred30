require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function updatePixKey() {
    try {
        // Verificar usuário atual
        const user = await pool.query('SELECT id, name, email, pix_key, cpf FROM users WHERE id = 2');
        console.log('Usuário atual:');
        console.log(user.rows[0]);

        // Usar o CPF do usuário como chave PIX (se tiver)
        const cpf = user.rows[0]?.cpf;

        if (cpf) {
            // Limpar CPF (remover pontos e traços)
            const cleanCpf = cpf.replace(/\D/g, '');

            // Atualizar chave PIX com o CPF
            await pool.query('UPDATE users SET pix_key = $1 WHERE id = 2', [cleanCpf]);
            console.log('\n✅ Chave PIX atualizada para CPF:', cleanCpf);
        } else {
            // Usar um CPF de teste válido
            const testCpf = '12345678909'; // CPF de teste válido (algoritmo correto)
            await pool.query('UPDATE users SET pix_key = $1 WHERE id = 2', [testCpf]);
            console.log('\n✅ Chave PIX atualizada para CPF de teste:', testCpf);
        }

        // Verificar resultado
        const updated = await pool.query('SELECT id, name, pix_key FROM users WHERE id = 2');
        console.log('\nNovo estado:', updated.rows[0]);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

updatePixKey();
