import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./src/tests/integration/setup.ts'],
        include: ['src/tests/**/*.test.ts'],
        testTimeout: 60000,
        hookTimeout: 60000,
    },
});
