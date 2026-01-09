/**
 * Script para LIMPAR o banco e manter apenas usuários
 * Uso: node scripts/database/clean-keep-users.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function cleanDatabase() {
  console.log('🧹 LIMPANDO BANCO - Mantendo apenas USUÁRIOS...\n');

  const tables = [
    'transactions',
    'quotas',
    'loans',
    'promo_videos',
    'education_lessons',
    'education_courses',
    'marketplace_orders',
    'marketplace_listings',
    'audit_logs',
    'terms_acceptance',
    'referral_codes',
    'notifications',
    'bug_reports',
    'system_config',
    'investment_pools',
    'earnings',
    'withdrawals',
    'deposits',
    'loan_installments',
    'credit_applications',
    'jobs',
    'job_applications'
  ];

  for (const table of tables) {
    try {
      await pool.query(`DELETE FROM ${table}`);
      console.log(`   ✅ ${table} - limpo`);
    } catch (err) {
      console.log(`   ⚠️ ${table} - erro ou não existe: ${err.message}`);
    }
  }

  // Manter usuários (não apagar)
  console.log('\n👤 USUÁRIOS MANTIDOS:\n');
  const users = await pool.query('SELECT id, name, email, is_admin, role FROM users ORDER BY id');
  users.rows.forEach(u => {
    console.log(`   ID ${u.id}: ${u.name} (${u.email}) - is_admin: ${u.is_admin}, role: ${u.role}`);
  });

  console.log('\n✅ Banco limpo! Apenas usuários foram mantidos.\n');

  await pool.end();
}

cleanDatabase().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
