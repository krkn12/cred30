const { Pool } = require('pg');

// Configuração do banco de dados
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'cred30user',
  password: process.env.DB_PASSWORD || 'cred30pass',
  database: process.env.DB_DATABASE || 'cred30',
});

async function clearExpiredTokens() {
  try {
    console.log('🔍 Limpando tokens expirados e verificando sistema...');
    
    // Verificar se há usuários no banco
    const usersResult = await pool.query('SELECT id, email, is_admin FROM users');
    console.log(`👥 Encontrados ${usersResult.rows.length} usuários no banco:`);
    usersResult.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, Email: ${user.email}, Admin: ${user.is_admin}`);
    });
    
    // Verificar configuração do sistema
    const configResult = await pool.query('SELECT * FROM system_config LIMIT 1');
    if (configResult.rows.length > 0) {
      const config = configResult.rows[0];
      console.log('⚙️ Configuração do sistema:', {
        system_balance: config.system_balance,
        profit_pool: config.profit_pool,
        quota_price: config.quota_price
      });
    } else {
      console.log('⚠️ Nenhuma configuração do sistema encontrada. Criando configuração padrão...');
      await pool.query(`
        INSERT INTO system_config (system_balance, profit_pool, quota_price, loan_interest_rate, penalty_rate, vesting_period_ms)
        VALUES (0, 0, 50, 0.2, 0.4, 365 * 24 * 60 * 60 * 1000)
      `);
      console.log('✅ Configuração padrão criada com sucesso!');
    }
    
    // Verificar transações pendentes
    const transactionsResult = await pool.query('SELECT COUNT(*) FROM transactions WHERE status = $1', ['PENDING']);
    console.log(`⏳ Transações pendentes: ${transactionsResult.rows[0].count}`);
    
    // Verificar empréstimos pendentes
    const loansResult = await pool.query('SELECT COUNT(*) FROM loans WHERE status = $1', ['PENDING']);
    console.log(`💰 Empréstimos pendentes: ${loansResult.rows[0].count}`);
    
    // Verificar se há tabela de tokens (se existir)
    try {
      const tokensTableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'auth_tokens'
        );
      `);
      
      if (tokensTableResult.rows[0].exists) {
        // Limpar tokens expirados
        const deleteResult = await pool.query(`
          DELETE FROM auth_tokens 
          WHERE expires_at < NOW()
          RETURNING id
        `);
        console.log(`🧹 ${deleteResult.rows.length} tokens expirados removidos`);
      } else {
        console.log('ℹ️ Tabela de tokens não encontrada (normal para esta versão)');
      }
    } catch (error) {
      console.log('ℹ️ Verificação de tokens ignorada (tabela não existe)');
    }
    
    console.log('✅ Verificação concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao limpar tokens expirados:', error);
  } finally {
    await pool.end();
  }
}

// Executar a limpeza
clearExpiredTokens();