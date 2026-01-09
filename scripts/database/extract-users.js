/**
 * Script para extrair dados do banco CRED30
 * Uso: node scripts/database/extract-users.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function extractData() {
  console.log('🔍 EXTRAINDO DADOS DO BANCO CRED30\n');
  console.log('='.repeat(60));

  // 1. Todos os usuários com is_admin e role
  console.log('\n👤 USUÁRIOS:\n');
  const users = await pool.query(`
    SELECT id, name, email, is_admin, role, status, balance, score, created_at 
    FROM users 
    ORDER BY id
  `);
  
  users.rows.forEach(u => {
    console.log(`ID: ${u.id} | ${u.name}`);
    console.log(`   Email: ${u.email}`);
    console.log(`   is_admin: ${u.is_admin} | role: ${u.role} | status: ${u.status}`);
    console.log(`   Balance: R$ ${parseFloat(u.balance || 0).toFixed(2)} | Score: ${u.score}`);
    console.log('');
  });

  // 2. Verificar se o ADMIN_EMAIL existe
  console.log('='.repeat(60));
  console.log('\n🔐 VERIFICAÇÃO DO ADMIN:\n');
  const adminEmail = process.env.ADMIN_EMAIL || 'josiassm701@gmail.com';
  const adminUser = await pool.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
  
  if (adminUser.rows.length > 0) {
    const u = adminUser.rows[0];
    console.log(`✅ Usuário encontrado: ${adminEmail}`);
    console.log(`   ID: ${u.id}`);
    console.log(`   is_admin: ${u.is_admin}`);
    console.log(`   role: ${u.role}`);
    console.log(`   status: ${u.status}`);
  } else {
    console.log(`❌ Usuário NÃO encontrado: ${adminEmail}`);
  }

  // 3. Todos os admins
  console.log('\n' + '='.repeat(60));
  console.log('\n🛡️ USUÁRIOS COM is_admin = true:\n');
  const admins = await pool.query('SELECT id, name, email, role FROM users WHERE is_admin = true');
  if (admins.rows.length > 0) {
    admins.rows.forEach(a => console.log(`   - ID ${a.id}: ${a.name} (${a.email}) | role: ${a.role}`));
  } else {
    console.log('   Nenhum usuário com is_admin = true');
  }

  // 4. Usuários com role = 'ADMIN'
  console.log('\n' + '='.repeat(60));
  console.log('\n👑 USUÁRIOS COM role = ADMIN:\n');
  const roleAdmins = await pool.query("SELECT id, name, email, role FROM users WHERE role = 'ADMIN'");
  if (roleAdmins.rows.length > 0) {
    roleAdmins.rows.forEach(a => console.log(`   - ID ${a.id}: ${a.name} (${a.email}) | role: ${a.role}`));
  } else {
    console.log('   Nenhum usuário com role = ADMIN');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ FIM DA EXTRAÇÃO\n');

  await pool.end();
}

extractData().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
