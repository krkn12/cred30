import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../packages/backend/.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function resetUser(email: string) {
    console.log(`Searching for user with email: ${email}`);
    const res = await pool.query('SELECT id, name, password_hash, two_factor_enabled FROM users WHERE email = $1', [email]);

    if (res.rows.length === 0) {
        console.log('User not found.');
        return;
    }

    const user = res.rows[0];
    console.log(`User found: ${user.name} (ID: ${user.id})`);
    console.log(`Has password hash? ${!!user.password_hash}`);
    console.log(`2FA enabled? ${user.two_factor_enabled}`);

    console.log('Resetting password_hash and secret_phrase to NULL...');

    await pool.query('UPDATE users SET password_hash = NULL, secret_phrase = NULL WHERE id = $1', [user.id]);

    console.log('Success! User should now be able to "Create Password" in Settings.');
}

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error('Please provide an email address as argument.');
        console.log('Usage: npx ts-node scripts/fix_google_passwords.ts user@example.com');
        process.exit(1);
    }

    try {
        await resetUser(email);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

main();
