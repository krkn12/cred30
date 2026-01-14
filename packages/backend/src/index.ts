import packageJson from '../package.json';
import 'dotenv/config';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { validateEnv } from './shared/schemas/env.schema';
// Validar variáveis de ambiente antes de qualquer outra coisa
validateEnv();

import { serve } from '@hono/node-server';
import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { etag } from 'hono/etag';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';

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

// ... (existing helper imports)

// ... inside startServer function

// Infraestrutura
import { initializeScheduler } from './scheduler';
import { initializeFirebaseAdmin } from './infrastructure/firebase/admin-config';
import { initializeDatabase, pool } from './infrastructure/database/postgresql/connection/pool';

const app = new Hono();

// Middlewares Globais
app.use('*', cors({
  origin: (origin) => {
    const allowed = [
      'https://cred30.site',
      'https://www.cred30.site',
      'https://cred30-prod-app-2025.web.app',
      'https://cred30-prod-app-2025.firebaseapp.com',
      'http://localhost:3000',
      'http://localhost:5173'
    ];
    if (allowed.includes(origin) || !origin) return origin || allowed[0];
    return allowed[0];
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
}));
app.use('*', compress());
app.use('*', etag());
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', timing());

// 🛡️ Global Error Handler
app.onError((err, c) => {
  console.error(`[SERVER ERROR] ${c.req.method} ${c.req.url}:`, err);

  const status = (err as any).status || 500;
  const message = err.message || 'Erro interno no servidor';

  return c.json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  }, status);
});

async function startServer() {
  const port = process.env.PORT || 3001;

  try {
    console.log('--- [BOOT] Iniciando Cred30 Backend ---');
    console.log(`--- [BOOT] Node version: ${process.version} ---`);
    console.log(`--- [BOOT] Porta configurada: ${port} ---`);

    // 1. Inicializar o Servidor HTTP IMEDIATAMENTE
    // Isso evita o Timeout do Render pois ele já consegue dar o "ping" na porta
    const serverInstance = serve({
      fetch: app.fetch,
      port: Number(port),
    }, (info) => {
      console.log(`🚀 [SERVER] Servidor rodando em http://localhost:${info.port}`);
    });

    console.log('--- [BOOT] Servidor HTTP iniciado, procedendo com infraestrutura... ---');

    // 2. Mapeamento de Rotas (precisa ser feito antes ou logo após o boot)
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

    // Rota raiz para o Health Check do Render
    app.get('/', (c: Context) => c.json({
      message: 'Cred30 API Online',
      version: packageJson.version,
      booting: true
    }));

    app.get('/api/health', (c: Context) => {
      return c.json({
        status: 'ok',
        version: packageJson.version,
        db: pool ? 'connected' : 'connecting',
        timestamp: new Date().toISOString()
      });
    });

    // 3. Inicialização Pesada (async)
    // Se isso der erro, o servidor já está rodando e podemos logar o erro sem sumir
    console.log('--- [DB] Conectando ao Banco de Dados... ---');
    await initializeDatabase().catch(err => {
      console.error('❌ [DB ERROR] Falha ao inicializar tabelas:', err);
    });

    console.log('--- [FIREBASE] Inicializando Admin... ---');
    initializeFirebaseAdmin();

    console.log('--- [SCHEDULER] Iniciando tarefas agendadas... ---');
    initializeScheduler(pool);

    console.log('✅ [BOOT] Sistema totalmente operacional!');

  } catch (error) {
    console.error('❌ [FATAL] Erro catastrófico no boot do servidor:', error);
    // No Render, se falhar, queremos que o processo morra para ele tentar de novo
    // mas com o log acima agora sabemos o porquê.
    setTimeout(() => process.exit(1), 1000);
  }
}

startServer();
