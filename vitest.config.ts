import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Node ≥ 25 punya localStorage bawaan yang kosong tanpa --localstorage-file dan menutupi
// localStorage milik happy-dom. Dimatikan (kalau Node-nya mengenal flag ini) supaya test client
// memakai Storage happy-dom.
const matikanWebStorageNode = process.allowedNodeEnvironmentFlags.has('--experimental-webstorage')
  ? ['--no-experimental-webstorage']
  : [];

export default defineConfig({
  resolve: {
    alias: {
      // Modul virtual vite-plugin-pwa hanya ada saat client di-build/dijalankan lewat Vite. Test yang
      // menyalakan main.ts (aplikasiKoneksi.test.ts) memakai pengganti ini.
      'virtual:pwa-register': fileURLToPath(new URL('./apps/client/test/tiruan/pwaRegister.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    // Environment bawaan tetap node (engine, meja, server: cepat, tanpa DOM).
    // Test client yang butuh DOM/localStorage memasang sendiri `// @vitest-environment happy-dom` di baris pertama.
    // Vitest 4: `poolOptions` sudah dihapus; execArgv ada di level `test`. Pool `forks` (child process)
    // ditulis eksplisit karena flag Node di atas hanya pasti berlaku di proses anak, bukan worker thread.
    pool: 'forks',
    execArgv: matikanWebStorageNode,
  },
});
