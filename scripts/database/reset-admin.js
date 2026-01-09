/**
 * Script para ZERAR o Admin (manter apenas usuários)
 * Uso: node scripts/database/reset-admin.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function resetAdmin() {
  console.log('🧹 ZERANDO ADMIN - Mantendo apenas USUÁRIOS...\n');

  // Tabelas do Admin para zerar (sem deletar usuários)
  const adminTables = [
    'transactions', 'quotas', 'loans', 'loan_installments',
    'promo_videos', 'promo_video_views',
    'education_courses', 'education_lessons', 'education_progress', 'education_sessions',
    'course_lessons', 'course_progress', 'course_purchases', 'course_reviews', 'courses',
    'marketplace_orders', 'marketplace_listings',
    'audit_logs', 'admin_logs',
    'notifications', 'bug_reports',
    'system_config', 'system_costs',
    'referral_codes',
    'terms_acceptance',
    'investment_pools', 'investments',
    'earnings', 'withdrawals', 'deposits',
    'credit_applications',
    'jobs', 'job_applications',
    'governance_proposals', 'governance_votes',
    'voting_proposals', 'voting_votes',
    'support_chats', 'support_messages',
    'transaction_reviews',
    'webhook_logs', 'rate_limit_logs',
    'products'
  ];

  for (const table of adminTables) {
    try {
      await pool.query(`DELETE FROM ${table}`);
      console.log(`   🗑️ ${table} - ZERADO`);
    } catch (err) {
      console.log(`   ⚠️ ${table} - erro: ${err.message.split('\n')[0]}`);
    }
  }

  // Resetar system_config para valores zerados
  try {
    await pool.query(`
      UPDATE system_config SET
        system_balance = 0,
        profit_pool = 0,
        total_tax_reserve = 0,
        total_operational_reserve = 0,
        total_owner_profit = 0,
        investment_reserve = 0,
        total_gateway_costs = 0,
        total_manual_costs = 0,
        monthly_fixed_costs = 0
    `);
    console.log('   ✅ system_config - RESETADO PARA ZERO');
  } catch (err) {
    // Se não existir, cria zerado
    try {
      await pool.query(`
        INSERT INTO system_config (system_balance, profit_pool, quota_price, loan_interest_rate, penalty_rate, vesting_period_ms)
        VALUES (0, 0, 50.00, 0.20, 0.40, 31536000000)
      `);
      console.log('   ✅ system_config - CRIADO ZERADO');
    } catch (e) {
      console.log(`   ⚠️ system_config: ${e.message}`);
    }
  }

  // Mostrar usuários restantes
  console.log('\n' + '='.repeat(60));
  console.log('\n👤 USUÁRIOS MANTIDOS:\n');

  const users = await pool.query('SELECT id, name, email, is_admin, role, balance FROM users ORDER BY id');
  users.rows.forEach(u => {
    console.log(`   ID ${u.id}: ${u.name} (${u.email})`);
    console.log(`      is_admin: ${u.is_admin} | role: ${u.role} | balance: R$ ${parseFloat(u.balance || 0).toFixed(2)}`);
  });

  // Mostrar contagem de registros
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 REGISTROS ZERADOS:\n');

  const counts = await pool.query(`
    SELECT 'users' as table_name, COUNT(*) as count FROM users
    UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
    UNION ALL SELECT 'quotas', COUNT(*) FROM quotas
    UNION ALL SELECT 'loans', COUNT(*) FROM loans
    UNION ALL SELECT 'system_config', COUNT(*) FROM system_config
    UNION ALL SELECT 'system_costs', COUNT(*) FROM system_costs
  `);

  counts.rows.forEach(r => {
    console.log(`   ${r.table_name}: ${r.count}`);
  });

  console.log('\n✅ ADMIN ZERADO! Apenas usuários foram mantidos.\n');

  await pool.end();
}

resetAdmin().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
