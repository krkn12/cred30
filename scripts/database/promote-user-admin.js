/**
 * Script para promover usuário a ADMIN
 * Uso: node scripts/database/promote-user-admin.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function promoteToAdmin() {
  const email = process.argv[2] || 'josiassm701@gmail.com';
  
  console.log(`🔄 Promovendo usuário ${email} a ADMIN...\n`);

  const result = await pool.query(`
    UPDATE users 
    SET is_admin = true, role = 'ADMIN', score = 1000, balance = 1000
    WHERE email = $1
    RETURNING id, name, email, is_admin, role, status
  `, [email]);

  if (result.rows.length > 0) {
    const u = result.rows[0];
    console.log('✅ USUÁRIO PROMOVIDO COM SUCESSO!');
    console.log(`   ID: ${u.id}`);
    console.log(`   Nome: ${u.name}`);
    console.log(`   Email: ${u.email}`);
    console.log(`   is_admin: ${u.is_admin}`);
    console.log(`   role: ${u.role}`);
    console.log(`   status: ${u.status}`);
  } else {
    console.log('❌ Usuário não encontrado');
  }

  await pool.end();
}

promoteToAdmin().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
