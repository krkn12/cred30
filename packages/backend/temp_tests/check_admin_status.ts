
import { Pool } from 'pg';

const connectionString = 'postgresql://neondb_owner:npg_ODLh9Hdv7eZR@ep-wild-surf-ahde2n7c.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function checkAdminProtected() {
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        const adminEmail = 'josiassm701@gmail.com';
        const res = await pool.query('SELECT email, is_protected, is_verified, is_verified_seller FROM users WHERE email = $1', [adminEmail]);
        console.log('STATUS DO ADMIN:', res.rows[0]);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkAdminProtected();
