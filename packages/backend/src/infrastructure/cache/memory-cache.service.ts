interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

class SimpleMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutos em milissegundos

  set<T>(key: string, data: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs || this.defaultTTL);
    this.cache.set(key, {
      data,
      expiresAt,
      createdAt: Date.now()
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Limpa entradas expiradas
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // Retorna estatísticas do cache
  getStats(): {
    size: number;
    hitRate?: number;
    memoryUsage: number;
  } {
    return {
      size: this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;
    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2; // Estimativa de string
      totalSize += JSON.stringify(entry.data).length * 2; // Estimativa de dados
      totalSize += 64; // Overhead do objeto
    }
    return totalSize;
  }
}

// Instância global do cache
const cache = new SimpleMemoryCache();

// Limpar cache expirado a cada minuto
setInterval(() => {
  cache.cleanup();
}, 60 * 1000);

export class CacheService {
  static set<T>(key: string, data: T, ttlMs?: number): void {
    cache.set(key, data, ttlMs);
  }

  static get<T>(key: string): T | null {
    return cache.get<T>(key);
  }

  static delete(key: string): boolean {
    return cache.delete(key);
  }

  static clear(): void {
    cache.clear();
  }

  // Cache para configurações do sistema (TTL mais longo)
  static setSystemConfig(config: any): void {
    cache.set('system_config', config, 30 * 60 * 1000); // 30 minutos
  }

  static getSystemConfig(): any | null {
    return cache.get('system_config');
  }

  // Cache para dados de usuário (TTL médio)
  static setUserProfile(userId: number, profile: any): void {
    cache.set(`user_profile_${userId}`, profile, 10 * 60 * 1000); // 10 minutos
  }

  static getUserProfile(userId: number): any | null {
    return cache.get(`user_profile_${userId}`);
  }

  static invalidateUser(userId: number): void {
    cache.delete(`user_profile_${userId}`);
  }

  // Cache para dashboard administrativo (TTL curto)
  static setAdminDashboard(data: any): void {
    cache.set('admin_dashboard', data, 2 * 60 * 1000); // 2 minutos
  }

  static getAdminDashboard(): any | null {
    return cache.get('admin_dashboard');
  }

  static invalidateAdminDashboard(): void {
    cache.delete('admin_dashboard');
  }

  // Cache para contagens (TTL muito curto)
  static setCounts(key: string, count: number): void {
    cache.set(`count_${key}`, count, 30 * 1000); // 30 segundos
  }

  static getCounts(key: string): number | null {
    return cache.get(`count_${key}`);
  }

  static invalidateCounts(key: string): void {
    cache.delete(`count_${key}`);
  }

  // Utilitários para invalidação em lote
  static invalidateUserRelated(userId: number): void {
    cache.delete(`user_profile_${userId}`);
    cache.delete(`user_quotas_${userId}`);
    cache.delete(`user_loans_${userId}`);
    cache.delete(`user_transactions_${userId}`);
  }

  static invalidateAdminRelated(): void {
    cache.delete('admin_dashboard');
    cache.delete('system_config');
    cache.delete('count_users');
    cache.delete('count_quotas');
    cache.delete('count_loans');
  }

  // Estatísticas do cache
  static getStats() {
    return cache.getStats();
  }
}

// Decorator para cache de funções
export function cached<T extends (...args: any[]) => Promise<any>>(
  keyGenerator: (...args: Parameters<T>) => string,
  ttlMs?: number
) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function(...args: Parameters<T>) {
      const key = keyGenerator(...args);
      
      // Tentar obter do cache
      const cached = CacheService.get(key);
      if (cached !== null) {
        return cached;
      }

      // Executar método original
      const result = await method.apply(this, args);
      
      // Armazenar no cache
      CacheService.set(key, result, ttlMs);
      
      return result;
    };

    return descriptor;
  };
}

// Middleware para adicionar headers de cache às respostas
export function addCacheHeaders(c: any, hit: boolean, ttl?: number): void {
  c.header('X-Cache', hit ? 'HIT' : 'MISS');
  if (ttl) {
    c.header('X-Cache-TTL', ttl.toString());
  }
}