import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'node18',
    minify: false, // Desativar minificação para desenvolvimento
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        format: 'es'
      }
    }
  },
  server: {
    port: 3001,
    host: true, // Aceitar conexões externas (ngrok)
    cors: true, // Habilitar CORS para desenvolvimento
    watch: {
      usePolling: false,
      interval: 100
    }
  },
  esbuild: {
    target: 'node18',
    platform: 'node',
    format: 'esm'
  },
  optimizeDeps: {
    include: ['pg', 'jsonwebtoken', 'bcrypt', 'zod', 'cors']
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('development')
  }
});