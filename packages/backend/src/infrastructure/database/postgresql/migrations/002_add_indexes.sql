import { getDbPool } from '../connection/pool';

/**
 * Cria índices otimizados para performance das consultas
 */
export async function createIndexes(pool?: any): Promise<void> {
  const dbPool = pool || getDbPool({} as any);
  
  try {
    console.log('Criando índices de performance...');
    
    // Índices para tabela users
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
      CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    `);
    
    // Índices para tabela quotas
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_quotas_user_id ON quotas(user_id);
      CREATE INDEX IF NOT EXISTS idx_quotas_status ON quotas(status);
      CREATE INDEX IF NOT EXISTS idx_quotas_purchase_date ON quotas(purchase_date);
      CREATE INDEX IF NOT EXISTS idx_quotas_user_status ON quotas(user_id, status);
    `);
    
    // Índices para tabela loans
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
      CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
      CREATE INDEX IF NOT EXISTS idx_loans_created_at ON loans(created_at);
      CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
      CREATE INDEX IF NOT EXISTS idx_loans_user_status ON loans(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_loans_pending_status ON loans(status) WHERE status = 'PENDING';
    `);
    
    // Índices para tabela transactions
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON transactions(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_transactions_pending ON transactions(status) WHERE status = 'PENDING';
      CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
    `);
    
    // Índices compostos para consultas frequentes
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_pending_admin ON transactions(status, created_at);
    `);
    
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_loans_pending_admin ON loans(status, created_at);
    `);
    
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_quotas_loans ON quotas(user_id);
    `);
    
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_loans_user_id ON loans(user_id);
    `);
    
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_created ON admin_logs(admin_id, created_at);
    `);
    
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_logs_entity_created ON admin_logs(entity_type, entity_id, created_at);
    `);
    
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_created ON rate_limit_logs(identifier, created_at);
    `);
    
    // Índices para sistema de configuração
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_system_config_id ON system_config(id);
    `);
    
    console.log('Índices de performance criados com sucesso');
  } catch (error) {
    console.error('Erro ao criar índices:', error);
    throw error;
  }
}

/**
 * Analisa performance das consultas (opcional, para ambiente de desenvolvimento)
 */
export async function analyzeQueryPerformance(): Promise<void> {
  const pool = getDbPool({} as any);
  
  try {
    // Verificar se índices estão sendo utilizados
    const unusedIndexes = await pool.query(`
      SELECT schemaname, tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname NOT LIKE '%_pkey'
        AND indexname NOT IN (
          SELECT indexname 
          FROM pg_stat_user_indexes 
          WHERE idx_scan > 0
        )
    `);
    
    if (unusedIndexes.rows.length > 0) {
      console.log('Índices não utilizados:', unusedIndexes.rows);
    }
    
    // Verificar consultas lentas (requiere pg_stat_statements)
    const slowQueries = await pool.query(`
      SELECT query, calls, total_time, mean_time, rows
      FROM pg_stat_statements 
      WHERE mean_time > 1000 -- consultas com mais de 1 segundo
      ORDER BY mean_time DESC 
      LIMIT 10
    `);
    
    if (slowQueries.rows.length > 0) {
      console.log('Consultas lentas detectadas:', slowQueries.rows);
    }
  } catch (error) {
    console.error('Erro ao analisar performance:', error);
  }
}

/**
 * Atualiza estatísticas do banco para melhor performance do planner
 */
export async function updateStatistics(): Promise<void> {
  const pool = getDbPool({} as any);
  
  try {
    await pool.query('ANALIZE;');
    console.log('Estatísticas do banco atualizadas');
  } catch (error) {
    console.error('Erro ao atualizar estatísticas:', error);
  }
}