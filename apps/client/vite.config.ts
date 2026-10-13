import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Versi tunggal ada di package.json root (SemVer). Semua workspace disamakan dengannya.
const versi: string = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

// Commit pendek: dari env GIT_SHA (Docker ARG) atau git lokal. Di Docker .git tidak ikut, jadi jangan sampai gagal.
function shaBuild(): string {
  if (process.env.GIT_SHA) return process.env.GIT_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  define: {
    __VERSI_APP__: JSON.stringify(versi),
    __BUILD_SHA__: JSON.stringify(shaBuild()),
    __BUILD_WAKTU__: JSON.stringify(new Date().toISOString()),
  },
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
    // Chunk Phaser (~1,4 MB mentah) tetap jauh di atas batas bawaan; yang penting ia terpisah dari kode app.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Phaser dipisah supaya hash-nya stabil antarrilis: update app tidak mengunduh ulang Phaser.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/]phaser[\\/]/.test(id)) return 'phaser';
        },
      },
    },
  },
  plugins: [
    VitePWA({
      // 'prompt': service worker baru menunggu sampai pemain setuju muat ulang (toast "versi baru"
      // dipasang di main.ts lewat registerSW onNeedRefresh), jadi tidak reload di tengah permainan.
      registerType: 'prompt',
      // Ikon manifest sudah ikut globPatterns (*.png); jangan dimasukkan dua kali ke precache.
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'Remi Kampung Madya',
        short_name: 'Remi Madya',
        description: 'Remi aturan Kedai Madya: main online bareng teman, atau offline bareng warga kedai.',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        background_color: '#0f3d22',
        theme_color: '#0f3d22',
        categories: ['games'],
        icons: [
          { src: 'ikon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'ikon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'ikon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Ikon, favicon, dan font tercakup di sini (tidak perlu includeAssets). manifest.webmanifest
        // sudah dimasukkan plugin sendiri, jadi tidak ikut pola supaya tidak dobel.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/ws/, /^\/healthz/, /^\/api\//],
      },
    }),
  ],
});
