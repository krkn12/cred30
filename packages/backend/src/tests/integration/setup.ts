import 'dotenv/config';

// Define ambiente de teste e segredos ANTES de importar o app
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_with_more_than_32_characters_for_validation';
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
