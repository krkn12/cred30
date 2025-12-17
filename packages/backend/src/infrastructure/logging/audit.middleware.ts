import { MiddlewareHandler } from 'hono';
import { getDbPool } from '../database/postgresql/connection/pool';

interface AuditLog {
  adminId: string; // Corrigido: era number, agora string (UUID)
  action: string;
  entityType: string;
  entityId?: string | number;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Middleware para auditoria de ações administrativas
 */
export const auditMiddleware = (action: string, entityType: string): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    
    // Capturar informações da requisição
    const auditData: AuditLog = {
      adminId: user.id, // Agora é UUID (string)
      action,
      entityType,
      entityId: body.id,
      newValues: body,
      ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent') || 'unknown'
    };
    
    // Executar a ação principal
    await next();
    
    // Registrar auditoria de forma assíncrona para não impactar performance
    logAuditAction(auditData).catch(error => {
      console.error('Erro ao registrar auditoria:', error);
    });
  };
};

/**
 * Registra ação de auditoria no banco de dados
 */
async function logAuditAction(auditData: AuditLog): Promise<void> {
  const pool = getDbPool({} as any);
  
  try {
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        auditData.adminId, // UUID como string
        auditData.action,
        auditData.entityType,
        auditData.entityId,
        auditData.oldValues ? JSON.stringify(auditData.oldValues) : null,
        auditData.newValues ? JSON.stringify(auditData.newValues) : null,
        auditData.ipAddress,
        auditData.userAgent
      ]
    );
  } catch (error) {
    console.error('Falha ao registrar auditoria:', error);
  }
}

/**
 * Cria tabela de auditoria se não existir
 */
export async function initializeAuditTable(pool?: any): Promise<void> {
  const dbPool = pool || getDbPool({} as any);
  
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        admin_id UUID REFERENCES users(id), -- Corrigido: era INTEGER, agora UUID
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(20) NOT NULL,
        entity_id VARCHAR(50),
        old_values JSONB,
        new_values JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Criar índices para performance
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_entity ON admin_logs(entity_type, entity_id);
    `);
    
    console.log('Tabela de auditoria inicializada com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar tabela de auditoria:', error);
  }
}
