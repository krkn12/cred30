const { Pool } = require('pg');

// Configuração do banco de dados
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'cred30user',
  password: process.env.DB_PASSWORD || 'cred30pass',
  database: process.env.DB_DATABASE || 'cred30'
});

async function resetDatabase() {
  console.log('🧹 Resetando banco de dados CRED30...');

  try {
    // Desabilitar triggers
    await pool.query('DROP TRIGGER IF EXISTS update_users_updated_at ON users');
    await pool.query('DROP TRIGGER IF EXISTS update_quotas_updated_at ON quotas');
    await pool.query('DROP TRIGGER IF EXISTS update_loans_updated_at ON loans');
    await pool.query('DROP TRIGGER IF EXISTS update_withdrawals_updated_at ON withdrawals');
    await pool.query('DROP TRIGGER IF EXISTS update_loan_installments_updated_at ON loan_installments');
    await pool.query('DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings');

    // Remover função
    await pool.query('DROP FUNCTION IF EXISTS update_updated_at_column()');

    // Dropar tabelas em ordem correta (primeira as que têm FK)
    await pool.query('DROP TABLE IF EXISTS loan_installments CASCADE');
    await pool.query('DROP TABLE IF EXISTS transactions CASCADE');
    await pool.query('DROP TABLE IF EXISTS withdrawals CASCADE');
    await pool.query('DROP TABLE IF EXISTS quotas CASCADE');
    await pool.query('DROP TABLE IF EXISTS loans CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    await pool.query('DROP TABLE IF EXISTS app_settings CASCADE');

    console.log('✅ Tabelas removidas com sucesso');

    // Recriar usando o script corrigido
    const fs = require('fs');
    const path = require('path');
    const initSqlPath = path.join(__dirname, 'init-db-fixed.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf8');
    
    await pool.query(initSql);
    console.log('✅ Banco de dados recriado com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao resetar banco de dados:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  resetDatabase().catch(console.error);
}

module.exports = { resetDatabase };