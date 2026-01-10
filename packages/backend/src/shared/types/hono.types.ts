// Definir o tipo de usuário para o contexto do Hono
export interface UserContext {
  id: string; // ID como UUID string (compatível com PostgreSQL)
  name: string;
  email: string;
  balance: number;
  joinedAt: number; // Timestamp em milissegundos
  referralCode: string;
  referredBy?: string; // Código do referidor
  isAdmin: boolean;
  role: 'MEMBER' | 'ATTENDANT' | 'ADMIN';
  status: 'ACTIVE' | 'BLOCKED';
  score: number;
  pixKey?: string;
  twoFactorEnabled?: boolean;
  cpf?: string | null;
  phone?: string | null;
  securityLockUntil?: number; // Timestamp em milissegundos
  membership_type?: string;
  is_verified?: boolean;
  is_seller?: boolean;
  video_points?: number;
  ad_points?: number;
  address?: string;
  total_dividends_earned?: number;
  last_login_at?: string;
  passwordHash?: string | null; // Para verificar se usuário tem senha (usuários Google não têm)
}

// Estender o tipo de variáveis do Hono
declare module 'hono' {
  interface ContextVariableMap {
    user: UserContext;
    dbPool: any; // Pool de conexões PostgreSQL
  }
}