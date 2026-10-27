/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // registered in src/app/pwa.ts so we can show an "update ready" prompt
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Kasa: Ghanaian languages',
        short_name: 'Kasa',
        description: 'Learn Twi and Ga the GES way, from Basic 1 to SHS 3.',
        lang: 'en-GH',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0D1210',
        theme_color: '#0D1210',
        categories: ['education'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Pronunciation audio rarely changes; keep it on the phone to save data
            urlPattern: ({ url }) => url.pathname.startsWith('/api/tts/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'kasa-audio',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Curriculum content: show cached copy instantly, refresh in the background
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /^\/api\/(levels|units|languages)\//.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'kasa-curriculum', expiration: { maxEntries: 500 } },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    // With VITE_USE_MOCKS=false, /api goes to the Django API (kasa-api) on port 8000
    proxy: { '/api': { target: process.env.KASA_API_URL ?? 'http://localhost:8000', changeOrigin: true } },
  },
  build: { target: 'es2022', sourcemap: true },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
  },
});
