/**
 * Script para criar config do sistema e dados básicos para o Admin
 * Uso: node scripts/database/fix-admin-system.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function fixAdminSystem() {
  console.log('🔧 Criando configurações básicas do Admin...\n');

  // 1. Criar system_config se não existir
  console.log('1. Verificando system_config...');
  const configCheck = await pool.query('SELECT COUNT(*) FROM system_config');
  if (parseInt(configCheck.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO system_config (
        system_balance, profit_pool, quota_price, loan_interest_rate,
        penalty_rate, vesting_period_ms, total_tax_reserve, total_operational_reserve,
        total_owner_profit, investment_reserve, total_gateway_costs, total_manual_costs
      ) VALUES (0, 0, 50.00, 0.20, 0.40, 31536000000, 0, 0, 0, 0, 0, 0)
    `);
    console.log('   ✅ system_config criado');
  } else {
    console.log('   ℹ️ system_config já existe');
  }

  // 2. Criar custos padrão se não existirem
  console.log('\n2. Verificando system_costs...');
  const costsCheck = await pool.query('SELECT COUNT(*) FROM system_costs');
  if (parseInt(costsCheck.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO system_costs (description, amount, is_recurring)
      VALUES
        ('Hospedagem Cloud (Mensal)', 89.90, true),
        ('Domínio e SSL (Mensal)', 29.90, true),
        ('Banco de Dados Neon (Mensal)', 25.00, true),
        ('Firebase (Mensal)', 15.00, true)
    `);
    console.log('   ✅ custos padrão criados');
  } else {
    console.log('   ℹ️ system_costs já tem dados');
  }

  // 3. Criar referral code para o admin
  console.log('\n3. Verificando referral_codes...');
  const adminEmail = 'josiassm701@gmail.com';
  const adminResult = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  if (adminResult.rows.length > 0) {
    const adminId = adminResult.rows[0].id;
    const codeCheck = await pool.query('SELECT COUNT(*) FROM referral_codes WHERE code = $1', ['ADMIN30']);
    if (parseInt(codeCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO referral_codes (code, created_by, is_active, max_uses)
        VALUES ('ADMIN30', $1, true, 1000)
      `, [adminId]);
      console.log('   ✅ referral code ADMIN30 criado');
    } else {
      console.log('   ℹ️ referral code já existe');
    }
  }

  // Mostrar resultado
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 STATUS ATUAL:\n');

  const config = await pool.query('SELECT * FROM system_config LIMIT 1');
  if (config.rows.length > 0) {
    const c = config.rows[0];
    console.log('System Config:');
    console.log(`   Saldo do Sistema: R$ ${parseFloat(c.system_balance || 0).toFixed(2)}`);
    console.log(`   Profit Pool: R$ ${parseFloat(c.profit_pool || 0).toFixed(2)}`);
    console.log(`   Preço da Cota: R$ ${parseFloat(c.quota_price || 50).toFixed(2)}`);
  }

  const costs = await pool.query('SELECT COUNT(*), SUM(amount) FROM system_costs');
  console.log(`\nCustos Fixos: ${costs.rows[0].count} registros`);
  console.log(`   Total Mensal: R$ ${parseFloat(costs.rows[0].sum || 0).toFixed(2)}`);

  const users = await pool.query('SELECT COUNT(*) FROM users');
  console.log(`\nUsuários: ${users.rows[0].count}`);

  const quotas = await pool.query('SELECT COUNT(*) FROM quotas WHERE status = $1', ['ACTIVE']);
  console.log(`Cotas Ativas: ${quotas.rows[0].count}`);

  console.log('\n✅ Sistema Admin pronto para uso!\n');

  await pool.end();
}

fixAdminSystem().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
