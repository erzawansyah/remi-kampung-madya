import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { idBuild } from '../../scripts/idBuild.mjs';

// Versi tunggal ada di package.json root (SemVer). Semua workspace disamakan dengannya.
const versi: string = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

// Identitas build: GIT_SHA > commit git > hash isi sumber "h-…" (scripts/idBuild.mjs), sama persis dengan
// yang disuntik ke server (bundel.mjs) supaya cocok dengan /healthz. Dev server cukup 'dev'. `vite preview`
// (juga command 'serve') tidak mengubah apa pun: ia menyajikan dist dengan id dari `vite build` sebelumnya.
function shaBuild(command: 'build' | 'serve'): string {
  if (command === 'serve') return 'dev';
  const { id, sumber } = idBuild();
  console.log(`id build client: ${id} (${sumber})`);
  return id;
}

export default defineConfig(({ command }) => ({
  define: {
    __VERSI_APP__: JSON.stringify(versi),
    __BUILD_SHA__: JSON.stringify(shaBuild(command)),
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
      // 'prompt': service worker baru menunggu sampai halaman memilih momen aman (pembaruan.ts, lewat
      // registerSW onNeedRefresh), jadi tidak reload di tengah permainan. Pengecualian untuk halaman
      // versi lama yang tidak bisa memintanya: lihat importScripts di bawah.
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
        // Jembatan dari 0.1.x (autoUpdate) ke 'prompt': halaman lama yang tidak menjawab sapa SW baru
        // tetap diperbarui (public/sw-transisi.js). Diambil sw.js saat dipasang, jadi tidak perlu precache.
        importScripts: ['sw-transisi.js'],
        manifestTransforms: [async (entri) => ({ manifest: entri.filter((e) => e.url !== 'sw-transisi.js'), warnings: [] })],
      },
    }),
  ],
}));
