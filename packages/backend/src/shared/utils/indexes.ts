import { Pool } from 'pg';

// Função para criar índices no banco de dados
export async function createIndexes(pool: Pool): Promise<void> {
  try {
    console.log('Criando índices do banco de dados...');

    // Índices para tabela users
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin)
    `);

    // Índices para tabela transactions
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON transactions(user_id, status)
    `);

    // Índices para tabela quotas
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_quotas_user_id ON quotas(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_quotas_status ON quotas(status)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_quotas_purchase_date ON quotas(purchase_date)
    `);

    // Índices para tabela loans
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_loans_created_at ON loans(created_at)
    `);

    // Índices para tabela audit_logs
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)
    `);

    // Índices compostos para consultas frequentes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_status_type ON transactions(user_id, status, type)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_quotas_user_status ON quotas(user_id, status)
    `);

    console.log('Índices criados com sucesso!');
  } catch (error) {
    console.error('Erro ao criar índices:', error);
    throw error;
  }
}

// Função para analisar performance das consultas
export async function analyzeQueryPerformance(pool: Pool): Promise<any[]> {
  try {
    const result = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Erro ao analisar performance das consultas:', error);
    return [];
  }
}

// Função para verificar índices ausentes
export async function checkMissingIndexes(pool: Pool): Promise<any[]> {
  try {
    const result = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats
      WHERE schemaname = 'public'
        AND tablename IN ('users', 'transactions', 'quotas', 'loans', 'audit_logs')
      ORDER BY tablename, n_distinct DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Erro ao verificar índices ausentes:', error);
    return [];
  }
}

// Função para otimizar tabelas
export async function optimizeTables(pool: Pool): Promise<void> {
  try {
    const tables = ['users', 'transactions', 'quotas', 'loans', 'audit_logs'];
    
    for (const table of tables) {
      await pool.query(`ANALYZE ${table}`);
      console.log(`Tabela ${table} analisada para otimização`);
    }
    
    console.log('Otimização das tabelas concluída!');
  } catch (error) {
    console.error('Erro ao otimizar tabelas:', error);
    throw error;
  }
}