import { MiddlewareHandler } from 'hono';
import { getDbPool } from '../../../infrastructure/database/postgresql/connection/pool';

interface RateLimitConfig {
  windowMs: number; // Janela de tempo em milissegundos
  maxRequests: number; // Máximo de requisições permitidas
  message?: string; // Mensagem de erro personalizada
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Middleware de rate limiting baseado em IP e usuário
 */
export function createRateLimit(config: RateLimitConfig): MiddlewareHandler {
  return async (c, next) => {
    const identifier = getRateLimitIdentifier(c);
    const now = Date.now();
    
    // Limpar entradas expiradas
    cleanupExpiredEntries(now);
    
    // Obter ou criar entrada para este identificador
    let entry = rateLimitStore.get(identifier);
    
    if (!entry || now > entry.resetTime) {
      // Nova entrada ou janela expirada
      entry = {
        count: 1,
        resetTime: now + config.windowMs
      };
      rateLimitStore.set(identifier, entry);
    } else {
      // Incrementar contador
      entry.count++;
    }
    
    // Verificar se excedeu o limite
    if (entry.count > config.maxRequests) {
      const resetIn = Math.ceil((entry.resetTime - now) / 1000);
      
      // Log de tentativa de rate limit exceeded
      await logRateLimitExceeded(c, identifier, entry.count);
      
      return c.json({
        success: false,
        message: config.message || `Muitas tentativas. Tente novamente em ${resetIn} segundos.`,
        retryAfter: resetIn
      }, 429);
    }
    
    // Adicionar headers de rate limit
    c.header('X-RateLimit-Limit', config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - entry.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());
    
    await next();
  };
}

/**
 * Rate limit específico para rotas administrativas (mais restritivo)
 */
export const adminRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxRequests: 200, // Aumentado para 200 requisições
  message: 'Limite de requisições administrativas excedido. Tente novamente em 15 minutos.'
});

/**
 * Rate limit para rotas de autenticação
 */
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxRequests: 100, // Aumentado para testes
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
});

/**
 * Rate limit para operações financeiras
 */
export const financialRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 50, // Aumentado para testes
  message: 'Muitas operações financeiras. Aguarde um momento antes de continuar.'
});

/**
 * Obtém identificador único para rate limiting (IP ou usuário autenticado)
 */
function getRateLimitIdentifier(c: any): string {
  // Se usuário autenticado, usar ID do usuário
  const user = c.get('user');
  if (user && user.id) {
    return `user:${user.id}`;
  }
  
  // Senão, usar IP
  const ip = c.req.header('x-forwarded-for') ||
              c.req.header('x-real-ip') ||
              c.req.header('cf-connecting-ip') ||
              '127.0.0.1'; // IP padrão para localhost
  
  return `ip:${ip}`;
}

/**
 * Limpa entradas expiradas do store
 */
function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Registra tentativas de rate limit exceeded para auditoria
 */
async function logRateLimitExceeded(c: any, identifier: string, count: number): Promise<void> {
  try {
    const pool = getDbPool(c);
    const user = c.get('user');
    
    await pool.query(
      `INSERT INTO rate_limit_logs (identifier, user_id, count, ip_address, user_agent, endpoint)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        identifier,
        user?.id || null,
        count,
        c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1',
        c.req.header('user-agent') || 'unknown',
        c.req.path || 'unknown'
      ]
    );
  } catch (error) {
    console.error('Erro ao registrar rate limit exceeded:', error);
  }
}

/**
 * Inicializa tabela de logs de rate limiting
 */
export async function initializeRateLimitTable(pool?: any): Promise<void> {
  const dbPool = pool || getDbPool({} as any);
  
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_logs (
        id SERIAL PRIMARY KEY,
        identifier VARCHAR(100) NOT NULL,
        user_id INTEGER REFERENCES users(id),
        count INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        endpoint VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Criar índices
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit_logs(identifier);
      CREATE INDEX IF NOT EXISTS idx_rate_limit_created_at ON rate_limit_logs(created_at);
    `);
    
    console.log('Tabela de rate limit logs inicializada com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar tabela de rate limit logs:', error);
  }
}