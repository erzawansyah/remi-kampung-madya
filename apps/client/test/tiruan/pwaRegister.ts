// Pengganti modul virtual `virtual:pwa-register` (vite-plugin-pwa) di Vitest, lewat alias di vitest.config.ts:
// modul virtual itu hanya ada saat client di-build atau dijalankan lewat Vite. Test yang menyalakan main.ts
// tetap boleh menggantinya dengan vi.mock('virtual:pwa-register', …).
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

export function registerSW(_opsi: RegisterSWOptions = {}): (muatUlang?: boolean) => Promise<void> {
  return async () => {};
}
