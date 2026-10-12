import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    // Saat dev, WebSocket diteruskan ke server Node (npm run dev:server).
    proxy: {
      '/ws': { target: 'ws://localhost:2567', ws: true },
      '/api': { target: 'http://localhost:2567' },
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Remi Kampung Madya',
        short_name: 'Remi Madya',
        description: 'Remi aturan Kedai Madya: main online bareng teman atau offline lawan bot.',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        background_color: '#0f3d22',
        theme_color: '#0f3d22',
        icons: [
          { src: 'ikon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'ikon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'ikon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/ws/, /^\/healthz/, /^\/api\//],
      },
    }),
  ],
});
