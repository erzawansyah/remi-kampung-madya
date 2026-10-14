// Tipe untuk scripts/idBuild.mjs (diimpor vite.config.ts dan test server).

export type SumberIdBuild = 'GIT_SHA' | 'git' | 'isi';

export interface OpsiIdBuild {
  /** Akar proyek yang di-hash / dicek git-nya. Bawaan: folder di atas scripts/. */
  akar?: string;
  /** Bawaan: process.env (GIT_SHA, ID_BUILD_TANPA_GIT). */
  env?: Record<string, string | undefined>;
  /** Dipanggil kalau GIT_SHA diisi tapi bukan commit. Bawaan: console.warn. */
  peringatan?: (pesan: string) => void;
}

export function idBuild(opsi?: OpsiIdBuild): { id: string; sumber: SumberIdBuild };

/** Hash isi sumber proyek, mis. "h-1a2b3c4". */
export function hashIsi(akar?: string): string;
