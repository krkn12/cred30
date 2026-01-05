import { Context, Next } from 'hono';

// Interface para configuração de rate limit
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

// Store simples em memória para rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Função para criar middleware de rate limit
export function createRateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    const clientIp = c.req.header('x-forwarded-for') ||
      c.req.header('x-real-ip') ||
      'unknown';

    const now = Date.now();

    // Limpar registros expirados
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }

    // Verificar limite atual
    const current = rateLimitStore.get(clientIp) || { count: 0, resetTime: now + config.windowMs };

    if (current.count >= config.maxRequests) {
      return c.json({
        success: false,
        message: config.message || 'Muitas tentativas. Tente novamente mais tarde.'
      }, 429);
    }

    // Incrementar contador
    current.count++;
    rateLimitStore.set(clientIp, current);

    await next();
  };
}

// Rate limits pré-configurados
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxRequests: 5,
  message: 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.'
});

export const adminRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 30,
  message: 'Muitas requisições administrativas. Tente novamente em 1 minuto.'
});

export const generalRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxRequests: 100,
  message: 'Muitas requisições. Tente novamente em 15 minutos.'
});