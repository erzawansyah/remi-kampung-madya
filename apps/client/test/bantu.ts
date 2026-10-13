// Alat bantu test client: permainan bot-vs-bot deterministik dan matchMedia palsu.
// Tidak mengimpor Phaser; hanya engine (murni) dan modul client yang tidak butuh WebGL.

import {
  buatPermainan,
  pilihAksiBot,
  Rng,
  terapkanAksi,
  viewUntuk,
  type Aksi,
  type GameState,
} from '@remi/engine';
import { vi } from 'vitest';

export interface LangkahPermainan {
  aksi: Aksi;
  sebelum: GameState;
  sesudah: GameState;
}

/**
 * Mainkan permainan bot-vs-bot dengan seed tetap sampai `putaran` putaran selesai.
 * Pola sama dengan packages/engine/test/simulasi.ts (bot normal, susun akhir urutan acak ber-seed).
 */
export function mainkanBot(jumlahPemain: number, seed: number, putaran: number): LangkahPermainan[] {
  let g: GameState = buatPermainan({
    pemain: Array.from({ length: jumlahPemain }, (_, i) => `Bot ${i + 1}`),
    seed,
    konfigurasi: { duaDeckUntukEmpat: false, batasPutaran: putaran, batasSkorAtas: null, batasSkorBawah: null },
  });
  const rng = new Rng(seed * 7919 + 1);
  const langkah: LangkahPermainan[] = [];
  while (g.status !== 'selesai') {
    let aksi: Aksi;
    if (g.status === 'putaranBerjalan') {
      aksi = pilihAksiBot(viewUntuk(g, g.putaran!.giliran), 'normal', rng);
    } else if (g.status === 'susunAkhir') {
      const belum = g.putaran!.selesaiSusun.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      const siapa = rng.pick(belum);
      aksi = pilihAksiBot(viewUntuk(g, siapa), 'normal', rng);
    } else {
      aksi = { jenis: 'mulaiPutaran' };
    }
    const h = terapkanAksi(g, aksi);
    if (!h.ok) throw new Error(`aksi bot ditolak (seed ${seed}): ${h.error.pesan}`);
    langkah.push({ aksi, sebelum: g, sesudah: h.state });
    g = h.state;
    if (langkah.length > 20000) throw new Error('permainan tidak selesai');
  }
  return langkah;
}

/**
 * Ganti localStorage dengan yang selalu melempar error, seperti Safari mode privat atau penyimpanan penuh.
 * Kembalikan dengan vi.unstubAllGlobals().
 */
export function pasangLocalStorageRusak(): void {
  const lempar = () => {
    throw new DOMException('Penyimpanan tidak tersedia', 'SecurityError');
  };
  vi.stubGlobal('localStorage', { getItem: lempar, setItem: lempar, removeItem: lempar, clear: lempar, key: lempar, length: 0 });
}

/** MediaQueryList palsu untuk prefers-reduced-motion yang nilainya bisa diubah dari test. */
export interface MediaPalsu {
  matches: boolean;
  /** Ubah nilai lalu kabari pendengar 'change', seperti saat pemain mengganti setelan sistem. */
  ubah(nilai: boolean): void;
  jumlahPendengar(): number;
}

export function pasangMatchMediaPalsu(awal = false): MediaPalsu {
  const pendengar = new Set<() => void>();
  const mql = {
    matches: awal,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, cb: () => void) => pendengar.add(cb),
    removeEventListener: (_: string, cb: () => void) => pendengar.delete(cb),
  };
  window.matchMedia = (() => mql) as unknown as typeof window.matchMedia;
  return {
    get matches() {
      return mql.matches;
    },
    ubah(nilai: boolean) {
      mql.matches = nilai;
      for (const cb of pendengar) cb();
    },
    jumlahPendengar: () => pendengar.size,
  };
}
