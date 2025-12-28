require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const r = await pool.query("SELECT id, email, is_admin, role FROM users WHERE is_admin = true OR role = 'ADMIN'");
    console.log('Admins:', r.rows);
    await pool.end();
}
main();
