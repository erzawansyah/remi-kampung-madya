// Token gerak (motion tokens) untuk animasi Phaser dan efek JS.
// Padanan CSS-nya ada di gaya.css (--durasi-*, --ease-*). Ubah keduanya bersamaan.
// Semua durasi dasar dalam ms untuk kecepatan "normal"; pakai durasi() supaya ikut preferensi.

import { gerakDikurangi, preferensi, skalaWaktu } from './preferensi';

/** Durasi dasar (ms). */
export const DURASI = {
  /** Umpan balik sentuh: tekan, angkat, sorot. */
  mikro: 110,
  /** Kartu naik/turun di tangan, perubahan kecil. */
  cepat: 180,
  /** Kartu terbang antar tempat (ambil, buang). */
  terbang: 420,
  /** Kartu dibagikan satu per satu (per kartu). */
  bagi: 260,
  /** Jeda antar kartu saat dibagikan. */
  jedaBagi: 70,
  /** Balik kartu (setengah putaran). */
  balik: 150,
  /** Kartu mendarat: settle setelah tiba. */
  mendarat: 140,
  /** Pamer kartu di tengah meja. */
  panggung: 900,
} as const;

/** Nama easing Phaser yang dipakai bersama. */
export const EASE = {
  /** Gerak biasa: cepat di awal, melambat di akhir (kartu meluncur di atas meja). */
  keluar: 'Cubic.easeOut',
  /** Masuk-keluar halus untuk perpindahan panjang. */
  halus: 'Sine.easeInOut',
  /** Sedikit lewat lalu kembali: kesan pegas saat kartu diangkat/mendarat. */
  pegas: 'Back.easeOut',
  /** Jatuh ke meja. */
  jatuh: 'Quad.easeIn',
  /** Tanpa percepatan (untuk progres/timer). */
  linear: 'Linear',
} as const;

/** Durasi sesudah dikali preferensi kecepatan dan gerak dikurangi. Minimal 0. */
export function durasi(ms: number): number {
  return Math.max(0, Math.round(ms * skalaWaktu()));
}

/** True kalau gerak besar (goyang layar, rotasi, lintasan melengkung, partikel) harus dihilangkan. */
export function kurangiGerak(): boolean {
  return gerakDikurangi();
}

/** True kalau efek dekoratif (partikel, kilau, bayangan dinamis) sebaiknya dihemat. */
export function efekHemat(): boolean {
  return preferensi().efek === 'hemat' || gerakDikurangi();
}

/**
 * Pegas teredam (damped spring) sebagai fungsi easing 0..1 untuk tween Phaser (opsi `ease` boleh fungsi).
 * Bawaan: lewat sedikit (≈6%) lalu tenang. Redaman lebih besar = lebih sedikit lewat.
 * Tidak memakai fisika per-frame.
 */
export function easePegas(redaman = 1, frekuensi = 1.5): (t: number) => number {
  const w = frekuensi * 2 * Math.PI;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 1 - Math.exp(-redaman * 10 * t) * Math.cos(w * t);
  };
}
