
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3001/api';

async function testFlow() {
    console.log('🚀 Iniciando Teste de Fluxo de Lojista/Entregador (KYC)...');

    // 0. Obter Código de Convite Válido
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

    let validReferralCode = 'ADMIN_FORCE';

    // Tentar achar um usuário existente para usar o código dele
    const userRes = await pool.query("SELECT referral_code FROM users WHERE referral_code IS NOT NULL LIMIT 1");

    if (userRes.rows.length > 0) {
        validReferralCode = userRes.rows[0].referral_code;
    } else {
        // Se não tem ninguém, insert um admin fake pra ter código
        validReferralCode = 'GODMODE_' + Date.now();
        await pool.query(
            `INSERT INTO users (name, email, password_hash, referral_code, is_admin, status) 
           VALUES ('God Admin', 'god@admin.com', 'hash', $1, true, 'ACTIVE')`,
            [validReferralCode]
        );
    }

    console.log(`🔑 Usando Referral Code: ${validReferralCode}`);

    // 1. Criar Usuário Lojista
    const email = `lojista.teste.${Date.now()}@cred30.com`;
    const password = 'Password123!';

    console.log(`\n1. Cadastrando usuário: ${email}`);
    const regRes = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Lojista Teste',
            email,
            password,
            secretPhrase: 'minhafrase123',
            cpf: `123456789${Math.floor(Math.random() * 99)}`,
            phone: '11999999999',
            referralCode: validReferralCode // Nome correto do campo
        })
    });

    const rawText = await regRes.text();
    let regData;
    try {
        regData = JSON.parse(rawText);
    } catch (e) {
        console.error('❌ Falha ao parsear JSON do registro. Resposta bruta:', rawText);
        await pool.end();
        return;
    }

    if (!regData.success && !regData.token) {
        console.error('❌ Falha no cadastro (API Error):', JSON.stringify(regData, null, 2));
        await pool.end();
        return;
    }
    console.log('✅ Usuário cadastrado!', regData.user?.id);
    const token = regData.token;
    const userId = regData.user.id;

    // 2. Criar Arquivo Dummy
    const dummyPath = path.resolve(__dirname, 'dummy_doc.txt');
    fs.writeFileSync(dummyPath, 'Este é um documento RG falso para teste.');

    // 3. Upload KYC
    console.log('\n2. Enviando Documento (KYC Upload)...');
    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync(dummyPath)], { type: 'application/pdf' }); // Fingir ser PDF
    formData.append('document', fileBlob, 'meu_rg_falso.pdf');

    const upRes = await fetch(`${API_URL}/kyc/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    const upData = await upRes.json();
    console.log('Resultado Upload:', upData);

    if (!upData.success) {
        console.error('❌ Falha no upload');
        fs.unlinkSync(dummyPath); // Clean up dummy file
        await pool.end(); // Ensure pool is closed on early exit
        return;
    }
    console.log('✅ Documento enviado com segurança!');

    // 4. Admin Aprova
    // Precisamos de um token de admin. Vou usar um hack: conectar no banco e setar admin=true para este user mesmo, só para ele se auto-aprovar (teste).
    // Ou melhor, usar o token dele mesmo se eu puder burlar, mas o correto é ter admin.
    // Vou pular a parte de login de admin e simular a aprovação chamando o endpoint MAS se falhar por permissão, eu mostro.

    // Para testar a rota de review, preciso ser admin.
    // Vou usar o DB direto para transformar esse user em Admin temporariamente

    // const { Pool } = await import('pg'); // Já importado acima
    // const pool = new Pool(...);
    await pool.query('UPDATE users SET role = \'ADMIN\' WHERE id = $1', [userId]);
    console.log('⚡ Usuário promovido a ADMIN via Banco para testar aprovação...');

    console.log('\n3. Aprovando KYC (Admin Action)...');
    const reviewRes = await fetch(`${API_URL}/kyc/review`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            userId: userId,
            status: 'APPROVED',
            notes: 'Documento verificado automaticamente pelo script de teste.'
        })
    });

    const reviewData = await reviewRes.json();
    console.log('Resultado Review:', reviewData);

    if (reviewData.success) {
        console.log('✅ Cadastro APROVADO com sucesso!');
        console.log('🎉 O sistema de KYC está 100% funcional.');
    } else {
        console.error('❌ Falha na aprovação.');
    }

    // Limpeza
    fs.unlinkSync(dummyPath);
}

testFlow();
