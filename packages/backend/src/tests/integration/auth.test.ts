import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../index';
import { pool } from '../../infrastructure/database/postgresql/connection/pool';

describe.skip('Auth Integration Tests', () => {
    // Usar email do admin para ignorar regras de indicação e focar no fluxo de infra
    const testUser = {
        name: 'Super Admin User',
        email: process.env.ADMIN_EMAIL || 'admin@cred30.site',
        password: 'Password123!',
        secretPhrase: 'MINHA FRASE SECRETA',
        pixKey: 'admin@pix.com',
        referralCode: 'TESTCODE'
    };

    beforeAll(async () => {
        try {
            console.log('--- [AUTH TEST] Cleanup starting ---');
            // Limpeza profunda usando TRUNCATE CASCADE
            await pool.query(`
                TRUNCATE TABLE 
                    users, 
                    transactions, 
                    quotas, 
                    loans, 
                    loan_installments, 
                    referral_codes, 
                    admin_logs, 
                    audit_logs 
                CASCADE
            `);

            // Garantir usuário padrinho para validar códigos de indicação
            const referrerRes = await pool.query(`
                INSERT INTO users (name, email, password_hash, secret_phrase, referral_code, is_admin, balance, score, status)
                VALUES ('Test Referrer', 'referrer@test.com', 'hash', 'frase', 'REF123', TRUE, 0, 0, 'ACTIVE')
                RETURNING id
            `);
            const creatorId = referrerRes.rows[0].id;

            // Inserir o código de teste
            await pool.query(`
                INSERT INTO referral_codes (code, is_active, max_uses, current_uses, created_by) 
                VALUES ($1, TRUE, 100, 0, $2)
            `, ['TESTCODE', creatorId]);

            console.log('--- [AUTH TEST] Cleanup finished ---');
        } catch (error: any) {
            console.error('--- [AUTH TEST] beforeAll Error:', error.message);
        }
    });

    it('should complete registration and login flow successfully', async () => {
        // 1. Register
        const regRes = await app.request('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        const regData = await regRes.json();
        if (regRes.status !== 201) console.log('❌ Register Error:', regRes.status, regData);
        expect(regRes.status).toBe(201);
        expect(regData.success).toBe(true);

        // 2. Login
        const logRes = await app.request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testUser.email,
                password: testUser.password,
                secretPhrase: testUser.secretPhrase
            })
        });
        const logData = await logRes.json();
        if (logRes.status !== 200) console.log('❌ Login Error:', logRes.status, logData);

        expect(logRes.status).toBe(200);
        expect(logData.success).toBe(true);
        expect(logData.data).toHaveProperty('token');

        // 3. Fail Login
        const failRes = await app.request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testUser.email,
                password: 'WrongPassword',
                secretPhrase: testUser.secretPhrase
            })
        });
        expect(failRes.status).toBe(401);
    });
});
