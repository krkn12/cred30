import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react() as any,
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'inline',
            includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
            manifest: {
                name: 'Cred30 Associativo',
                short_name: 'Cred30',
                description: 'Plataforma de Apoio Mútuo e Participação Social',
                theme_color: '#09090b',
                background_color: '#09090b',
                display: 'standalone',
                display_override: ['standalone', 'window-controls-overlay'],
                orientation: 'portrait',
                start_url: '/',
                scope: '/',
                lang: 'pt-BR',
                dir: 'ltr',
                categories: ['finance', 'productivity', 'social'],
                id: 'com.cred30.app',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '1024x1024',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '1024x1024',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '1024x1024',
                        type: 'image/png',
                        purpose: 'maskable'
                    }
                ],
                screenshots: [
                    {
                        src: 'ad-banner.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        form_factor: 'wide',
                        label: 'Homescreen do App'
                    }
                ],
                shortcuts: [
                    {
                        name: 'Investir',
                        url: '/?view=invest',
                        icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
                    },
                    {
                        name: 'Academy',
                        url: '/?view=education',
                        icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
                cleanupOutdatedCaches: true,
                skipWaiting: true,
                clientsClaim: true,
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'gstatic-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'images-cache',
                            expiration: {
                                maxEntries: 60,
                                maxAgeSeconds: 60 * 60 * 24 * 30
                            }
                        }
                    },
                    {
                        urlPattern: /^\/api\/.*$/,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            networkTimeoutSeconds: 5,
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ]
            }
        }) as any
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3003,
        host: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
            }
        }
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'esbuild',
        target: 'es2020',
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    // React core - carregado sempre
                    if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                        return 'vendor-react';
                    }
                    // UI libraries
                    if (id.includes('lucide-react') || id.includes('@headlessui')) {
                        return 'vendor-ui';
                    }
                    // Heavy utilities - lazy loaded
                    if (id.includes('jspdf') || id.includes('@google/genai')) {
                        return 'vendor-heavy';
                    }
                    // Admin views - lazy loaded separately
                    if (id.includes('/views/Admin') || id.includes('/views/Support')) {
                        return 'chunk-admin';
                    }
                    // Axios - network requests
                    if (id.includes('axios')) {
                        return 'vendor-network';
                    }
                }
            }
        },
        chunkSizeWarningLimit: 800,
        cssCodeSplit: true,
        assetsInlineLimit: 4096
    }
})
