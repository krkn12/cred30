import packageJson from '../package.json';
import 'dotenv/config';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { validateEnv } from './shared/schemas/env.schema';
import { validateJwtSecret } from './shared/utils/jwt-validation.utils';

// Validar variáveis de ambiente e segurança JWT antes de qualquer outra coisa
// Validações movidas para startServer() para evitar execuções indesejadas em testes.


// Force restart: Logistics Fee Fix at 2026-01-29 Audit
import { serve } from '@hono/node-server';
import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { etag } from 'hono/etag';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';

/**
 * 🚀 INSTÂNCIA DO APP
 * Deve ser definida ANTES da importação das rotas para evitar problemas de dependência circular
 */
export const app = new Hono();

// Importação das Rotas
import { authRoutes } from './presentation/http/routes/auth.routes';
import { userRoutes } from './presentation/http/routes/users.routes';
import { quotaRoutes } from './presentation/http/routes/quotas.routes';
import { loanRoutes } from './presentation/http/routes/loans.routes';
import { transactionRoutes } from './presentation/http/routes/transactions.routes';
import { adminRoutes } from './presentation/http/routes/admin.routes';
import { withdrawalRoutes } from './presentation/http/routes/withdrawals.routes';
import { productsRoutes } from './presentation/http/routes/products.routes';
import { webhookRoutes } from './presentation/http/routes/webhooks.routes';
import { notificationRoutes } from './presentation/http/routes/notifications.routes';
import { marketplaceRoutes } from './presentation/http/routes/marketplace.routes';
import { educationRoutes } from './presentation/http/routes/education.routes';
import { votingRoutes } from './presentation/http/routes/voting.routes';
import { monetizationRoutes } from './presentation/http/routes/monetization.routes';
import { promoVideosRoutes } from './presentation/http/routes/promo-videos.routes';
import { bugReportsRoutes } from './presentation/http/routes/bug-reports.routes';
import { earnRoutes } from './presentation/http/routes/earn.routes';
import { sellerRoutes } from './presentation/http/routes/seller.routes';
import { tutorRoutes } from './presentation/http/routes/tutors.routes';
import { logisticsRoutes } from './presentation/http/routes/logistics.routes';
import { consortiumRoutes } from './presentation/http/routes/consortium.routes';
import { pdvRoutes } from './presentation/http/routes/pdv.routes';
import { kycRoutes } from './presentation/http/routes/kyc.routes';
import { termsRoutes } from './presentation/http/routes/terms.routes';
import { claimsRoutes } from './presentation/http/routes/claims.routes';

// Infraestrutura
import { initializeScheduler } from './scheduler';
import { initializeFirebaseAdmin } from './infrastructure/firebase/admin-config';
import { initializeDatabase, pool } from './infrastructure/database/postgresql/connection/pool';

// Middlewares Globais
app.use('*', cors({
  origin: (origin: string | undefined) => {
    const allowed = [
      'https://cred30.site',
      'https://www.cred30.site',
      'https://cred30-prod-app-2025.web.app',
      'https://cred30-prod-app-2025.firebaseapp.com',
      'http://localhost:3000',
      'http://localhost:3003',
      'http://localhost:5173'
    ];
    // Em produção, restringimos mais. No desenvolvimento, permitimos localhost.
    if (!origin) return allowed[0]; // Permite apps mobile/ferramentas de teste
    if (allowed.includes(origin)) return origin;

    console.warn(`[SECURITY] Origem bloqueada pelo CORS: ${origin}`);
    return allowed[0]; // Fallback para a primeira origem
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
}));

app.use('*', compress());
app.use('*', etag());
app.use('*', logger());
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://*.firebaseapp.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    imgSrc: ["'self'", "data:", "https://*"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    frameSrc: ["'self'", "https://*.firebaseapp.com"],
    connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "https://*.adsterra.com"]
  },
  strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload', // HSTS Ativado (2 anos)
  xXssProtection: '1; mode=block',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'no-referrer',
  xFrameOptions: 'DENY' // Impede Clickjacking
}));
app.use('*', timing());

// 🛡️ Rate Limiting Simples (Blindagem contra DoS)
const rateLimitMap = new Map<string, { count: number, resetAt: number }>();
app.use('*', async (c: Context, next: any) => {
  const ip = c.req.header('x-forwarded-for') || 'local';
  const now = Date.now();
  const limit = 100; // 100 requisições
  const windowMs = 60 * 1000; // 1 minuto

  let record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + windowMs };
  }

  record.count++;
  rateLimitMap.set(ip, record);

  if (record.count > limit) {
    return c.json({ success: false, message: 'Muitas requisições. Tente novamente em 1 minuto.' }, 429);
  }

  await next();
});

// 🛡️ Global Error Handler
app.onError((err: unknown, c: Context) => {
  console.error(`[SERVER ERROR] ${c.req.method} ${c.req.url}:`, err);

  const status = err.status || 500;
  const message = err.message || 'Erro interno no servidor';

  return c.json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  }, status);
});

// 🚀 Registro de Rotas (Disponíveis para App e Testes)
app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/quotas', quotaRoutes);
app.route('/api/loans', loanRoutes);
app.route('/api/transactions', transactionRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/withdrawals', withdrawalRoutes);
app.route('/api/products', productsRoutes);
app.route('/api/webhooks', webhookRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/marketplace', marketplaceRoutes);
app.route('/api/monetization', monetizationRoutes);
app.route('/api/education', educationRoutes);
app.route('/api/voting', votingRoutes);
app.route('/api/promo-videos', promoVideosRoutes);
app.route('/api/bugs', bugReportsRoutes);
app.route('/api/earn', earnRoutes);
app.route('/api/seller', sellerRoutes);
app.route('/api/logistics', logisticsRoutes);
app.route('/api/tutors', tutorRoutes);
app.route('/api/consortium', consortiumRoutes);
app.route('/api/pdv', pdvRoutes);
app.route('/api/terms', termsRoutes);
app.route('/api/claims', claimsRoutes);
app.route('/api/kyc', kycRoutes);

// Rotas Base e Health Check
app.get('/', (c: Context) => c.json({
  message: 'Cred30 API Online',
  version: packageJson.version
}));

app.get('/api/health', (c: Context) => {
  return c.json({
    status: 'ok',
    version: packageJson.version,
    db: pool ? 'connected' : 'connecting',
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  const port = process.env.PORT || 3001;

  // Validar variáveis de ambiente apenas ao iniciar o servidor
  console.log(`--- [BOOT] NODE_ENV: ${process.env.NODE_ENV} ---`);
  validateEnv();
  validateJwtSecret();

  try {
    console.log('--- [BOOT] Iniciando Cred30 Backend ---');
    console.log(`--- [BOOT] Node version: ${process.version} ---`);
    console.log(`--- [BOOT] Porta configurada: ${port} ---`);

    // 1. Inicializar o Servidor HTTP
    const serverInstance = serve({
      fetch: app.fetch,
      port: Number(port),
    }, (info: any) => {
      console.log(`🚀 [SERVER] Servidor rodando em http://localhost:${info.port}`);
    });

    console.log('--- [BOOT] Servidor HTTP iniciado, procedendo com infraestrutura... ---');

    // 3. Inicialização Pesada (async)
    // Se isso der erro, o servidor já está rodando e podemos logar o erro sem sumir
    console.log('--- [DB] Conectando ao Banco de Dados... ---');
    try {
      await initializeDatabase();
    } catch (err: unknown) {
      console.error('--- [DB] Falha ao conectar/migrar Banco de Dados:', err.message);
    }

    console.log('--- [INFRA] Inicializando Firebase e Scheduler... ---');
    initializeFirebaseAdmin();
    initializeScheduler(pool);

    console.log('✅ [BOOT] Sistema totalmente operacional!');

  } catch (error: unknown) {
    console.error('❌ [FATAL] Erro catastrófico no boot do servidor:', error);
    // No Render, se falhar, queremos que o processo morra para ele tentar de novo
    setTimeout(() => process.exit(1), 1000);
  }
}

app.notFound((c: Context) => {
  // Ignorar favicon no log se for barulhento
  if (c.req.path.includes('favicon')) return c.json({}, 404);
  console.log(`⚠️ [404] Not Found: ${c.req.method} ${c.req.url}`);
  return c.json({ success: false, message: 'Rota não encontrada' }, 404);
});

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
