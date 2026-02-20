import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./src/tests/integration/setup.ts'],
        include: ['src/tests/**/*.test.ts'],
        testTimeout: 60000,
        hookTimeout: 60000,
        env: {
            NODE_ENV: 'test',
            JWT_SECRET: 'VitestStrongSecretForTestingAvailableBeforeAnyCodeLoads',
            ADMIN_EMAIL: 'admin@cred30.site',
            // Força o pool a usar 127.0.0.1 e ignorar SSL
            DB_HOST: '127.0.0.1',
            DB_PORT: '5432',
            DB_USER: 'postgres',
            DB_PASSWORD: 'postgres',
            DB_DATABASE: 'cred30_test',
        }
    },
});
