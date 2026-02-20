import 'dotenv/config';

// Define ambiente de teste e segredos ANTES de importar o app
process.env.NODE_ENV = 'test';
// Tenta pegar do ENV, se não tiver, usa undefined (vai falhar na validação se o CI não passar)
process.env.JWT_SECRET = process.env.JWT_SECRET;
// Se estiver indefinido, define um fallback APENAS se não for CI, mas para garantir, vamos deixar sem fallback fraco.
if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET não definido. Usando fallback seguro gerado dinamicamente.');
    process.env.JWT_SECRET = 'dynamic_fallback_' + Math.random().toString(36).substring(7) + '_strictly_for_tests_locally';
}
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@cred30.site';

import { beforeAll, afterAll } from 'vitest';
import { initializeDatabase, pool } from '../../infrastructure/database/postgresql/connection/pool';

/**
 * Setup global para testes de integração
 * Garante que o banco de dados está pronto antes de rodar os testes
 */
beforeAll(async () => {
    // Define ambiente de teste se não estiver definido
    if (!process.env.NODE_ENV) {
        process.env.NODE_ENV = 'test';
    }

    console.log('[SETUP DEBUG] NODE_ENV:', process.env.NODE_ENV);
    console.log('[SETUP DEBUG] DB_HOST:', process.env.DB_HOST);
    console.log('[SETUP DEBUG] JWT_SECRET Length:', process.env.JWT_SECRET?.length);
    console.log('[SETUP DEBUG] JWT_SECRET First 5:', process.env.JWT_SECRET?.substring(0, 5));
    console.log('[SETUP DEBUG] DATABASE_URL Exists:', !!process.env.DATABASE_URL);

    // Inicializa o banco (cria tabelas se não existirem)
    try {
        await initializeDatabase();
        console.log('✅ Banco de dados de teste inicializado');
    } catch (error) {
        console.error('❌ Erro ao inicializar banco de dados de teste:', error);
    }
});

afterAll(async () => {
    await pool.end();
    console.log('💤 Pool de conexões encerrado');
});
