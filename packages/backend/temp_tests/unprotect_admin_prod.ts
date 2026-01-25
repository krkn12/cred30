
import { Pool } from 'pg';

const connectionString = 'postgresql://neondb_owner:npg_ODLh9Hdv7eZR@ep-wild-surf-ahde2n7c.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function unprotectAdmin() {
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        console.log('📉 REMOVENDO PROTEÇÃO MÚTUA DO ADMIN... 📉');

        await pool.query(`
            UPDATE users 
            SET is_protected = FALSE,
                protection_expires_at = NULL
            WHERE email = 'josiassm701@gmail.com'
        `);

        console.log('✅ Admin desprotegido.');

    } catch (err) {
        console.error('❌ ERRO:', err);
    } finally {
        await pool.end();
    }
}

unprotectAdmin();
