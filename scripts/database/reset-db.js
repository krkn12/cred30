const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'cred30user',
  password: process.env.DB_PASSWORD || 'cred30pass',
  database: process.env.DB_DATABASE || 'cred30',
});

async function resetDatabase() {
  console.log('🔄 Resetando banco de dados...');
  
  try {
    // Limpar todas as tabelas em ordem correta para evitar conflitos de FK
    await pool.query('DELETE FROM transactions');
    await pool.query('DELETE FROM loan_installments');
    await pool.query('DELETE FROM loans');
    await pool.query('DELETE FROM quotas');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM system_config');
    
    // Reiniciar sequências
    await pool.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE quotas_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE loans_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE transactions_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE system_config_id_seq RESTART WITH 1');
    
    // Inserir configuração padrão
    await pool.query(`
      INSERT INTO system_config (system_balance, profit_pool, quota_price, loan_interest_rate, penalty_rate, vesting_period_ms)
      VALUES (0, 0, 50, 0.2, 0.4, 31536000000)
    `);
    
    console.log('✅ Banco de dados resetado com sucesso!');
    console.log('📊 Configuração padrão inserida');
    
  } catch (error) {
    console.error('❌ Erro ao resetar banco de dados:', error);
  } finally {
    await pool.end();
  }
}

resetDatabase();