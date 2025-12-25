require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function testLogin(email, password, secretPhrase) {
    try {
        console.log('Testing login for:', email);

        // 1. Query User
        const result = await pool.query(
            'SELECT id, name, email, password_hash, secret_phrase, panic_phrase, is_under_duress, safe_contact_phone, pix_key, referral_code, is_admin, balance, score, created_at, is_email_verified, two_factor_enabled, two_factor_secret, status, role FROM users WHERE email = $1',
            [email]
        );

        const user = result.rows[0];
        if (!user) {
            console.log('User not found');
            return;
        }

        console.log('User found:', user.name);

        // 2. Check Password
        const isPasswordValid = user.password_hash ?
            await bcrypt.compare(password, user.password_hash) :
            password === user.password_hash;

        console.log('Password valid:', isPasswordValid);

        // 3. Check Secret Phrase
        const isPhraseValid = user.secret_phrase === secretPhrase;
        console.log('Secret phrase valid:', isPhraseValid);

        // 4. Check Status
        console.log('User status:', user.status);

    } catch (err) {
        console.error('Error during login test:', err);
    } finally {
        await pool.end();
    }
}

testLogin('milene@gmail.com', '32588589', 'passeiola');
