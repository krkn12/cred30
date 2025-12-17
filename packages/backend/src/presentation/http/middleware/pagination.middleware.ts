import { MiddlewareHandler } from 'hono';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Middleware para extrair parâmetros de paginação da requisição
 */
export function extractPagination(c: any): PaginationOptions {
  const url = new URL(c.req.url || '', `http://${c.req.headers.host}`);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100); // Máximo 100 por página
  const sortBy = url.searchParams.get('sortBy') || 'created_at';
  const sortOrder = (url.searchParams.get('sortOrder') || 'DESC').toUpperCase() as 'ASC' | 'DESC';
  
  return {
    page: Math.max(1, page),
    limit: Math.max(1, limit),
    sortBy,
    sortOrder
  };
}

/**
 * Constrói query de paginação PostgreSQL
 */
export function buildPaginationQuery(
  baseQuery: string,
  options: PaginationOptions
): { query: string; params: any[] } {
  const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = options;
  
  // Validar sortBy para evitar SQL injection
  const allowedSortFields = ['created_at', 'amount', 'status', 'name', 'email'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
  
  const offset = (page - 1) * limit;
  
  const query = `
    ${baseQuery}
    ORDER BY ${safeSortBy} ${sortOrder}
    LIMIT $1 OFFSET $2
  `;
  
  return {
    query,
    params: [limit, offset]
  };
}

/**
 * Constrói query de paginação com contagem total
 */
export function buildPaginatedQuery(
  baseQuery: string,
  options: PaginationOptions
): { 
  countQuery: string; 
  dataQuery: string; 
  params: any[] 
} {
  const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = options;
  
  // Validar sortBy para evitar SQL injection
  const allowedSortFields = ['created_at', 'amount', 'status', 'name', 'email'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
  
  const offset = (page - 1) * limit;
  
  const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as subquery`;
  
  const dataQuery = `
    ${baseQuery}
    ORDER BY ${safeSortBy} ${sortOrder}
    LIMIT $1 OFFSET $2
  `;
  
  return {
    countQuery,
    dataQuery,
    params: [limit, offset]
  };
}

/**
 * Formata resultado paginado
 */
export function formatPaginatedResult<T>(
  data: T[],
  total: number,
  options: PaginationOptions
): PaginatedResult<T> {
  const { page = 1, limit = 20 } = options;
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * Middleware para adicionar headers de paginação à resposta
 */
export function addPaginationHeaders(c: any, result: PaginatedResult<any>): void {
  const { pagination } = result;
  
  c.header('X-Total-Count', pagination.total.toString());
  c.header('X-Page-Count', pagination.totalPages.toString());
  c.header('X-Current-Page', pagination.page.toString());
  c.header('X-Per-Page', pagination.limit.toString());
  c.header('X-Has-Next', pagination.hasNext.toString());
  c.header('X-Has-Prev', pagination.hasPrev.toString());
}

/**
 * Middleware de paginação para rotas de listagem
 */
export function paginationMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const pagination = extractPagination(c);
    c.set('pagination', pagination);
    await next();
  };
}