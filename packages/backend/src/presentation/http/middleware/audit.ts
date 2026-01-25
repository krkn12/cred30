import { Context, Next } from 'hono';

// Função para criar middleware de auditoria
export function auditMiddleware(action: string, resource: string) {
  return async (c: Context, next: Next) => {
    // Implementação básica de auditoria
    const userId = c.get('userId');
    const timestamp = new Date().toISOString();
    
    console.log(`[AUDIT] ${timestamp} - User: ${userId} - Action: ${action} - Resource: ${resource}`);
    
    await next();
  };
}

// Função para inicializar tabela de auditoria
export async function initializeAuditTable(pool: any) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id UUID,
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        details JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address INET
      )
    `);
    
    console.log('Tabela de auditoria inicializada com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar tabela de auditoria:', error);
  }
}