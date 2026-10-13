// Efek suara dan getar HP: satu pintu untuk seluruh aplikasi.
// Semua bunyi disintesis Web Audio (tanpa file audio, aman offline). Karakternya "kartu fisik di meja kayu
// kedai": gesekan dan ketukan kertas dari derau tersaring, isyarat bernada dari bilah ala gamelan dan
// kendang yang dilunakkan, semuanya di tangga nada D mayor pentatonik supaya selaras dengan musik latar.
//
// PAGAR INFO RAHASIA (keputusan pemilik): bunyi dan getar hanya boleh dipicu peristiwa publik atau aksi
// pemain sendiri. Tidak ada bunyi/getar yang membedakan joker di tangan, dan tidak ada peringatan
// "kartu berbahaya". Bunyi 'joker' hanya untuk kejadian joker yang terlihat semua orang
// (pengumuman joker di awal putaran, joker dibuang ke meja), bukan untuk joker yang masuk tangan.

import { gerakDikurangi, preferensi } from '../preferensi';
import { bangunRantai, bisaBersuara, keluaranEfek, mesinAudio, pasangMesinAudio } from './mesinAudio';
import { pasangMusik } from './musik';
import { acak, bilah, dung, gemeretak, gesek, gong, hz, ketuk, nada, tak, type Keluaran } from './sintesis';

export { suasanaMusik, type AdeganMusik } from './musik';
export { diagnostikAudio } from './mesinAudio';

export type JenisBunyi =
  // Kartu fisik
  | 'kartu' // ambil kartu dari deck
  | 'kocok' // mengocok (riffle) ~0,6 detik
  | 'bagi' // satu kartu dibagikan, meluncur pendek
  | 'balik' // kartu dibalik
  | 'angkat' // kartu terangkat dari tangan (sangat halus)
  | 'letak' // kartu diletakkan di meja
  | 'geser' // geser/susun ulang kartu di tangan
  | 'buang' // kartu dibuang ke buangan
  | 'mulung' // mungut dari buangan
  // Isyarat permainan
  | 'giliran'
  | 'sorak'
  | 'mentung'
  | 'kepentung'
  | 'bahaya' // kejadian publik yang perlu diwaspadai (kartumu dipungut, lawan tinggal 1 kartu)
  | 'joker' // kejadian joker yang publik saja (lihat pagar di atas)
  | 'tegang' // gebukan kendang makin rapat sebelum pentungan dibuka
  | 'detak' // detak jantung pelan
  | 'menang'
  | 'kalah'
  // Antarmuka
  | 'pop' // gelembung emote
  | 'klik' // tombol
  | 'tolak' // aksi tidak sah: lembut, bukan buzzer
  | 'notifikasi';

export interface OpsiBunyi {
  /**
   * Urutan dalam satu rangkaian (0, 1, 2, ...): nada naik sedikit per langkah (maks 12),
   * mis. kartu yang dibagikan beruntun atau kartu jadi yang diturunkan satu per satu.
   */
  urutan?: number;
}

/** Variasi acak kecil per putar supaya bunyi yang sering diulang tidak terasa seperti mesin. */
interface Variasi {
  /** Pengali frekuensi untuk bunyi derau (gesekan/ketukan). */
  p: number;
  /** Pengali frekuensi untuk bunyi bernada (lebih kecil supaya tetap selaras). */
  pn: number;
  /** Pengali volume. */
  v: number;
}

/** Resep bunyi: menjadwalkan node mulai waktu t, mengembalikan perkiraan durasi (detik). */
type Resep = (k: Keluaran, t: number, x: Variasi) => number;

// Nada (MIDI) di D mayor pentatonik.
const D4 = 62, E4 = 64, Fs4 = 66, A4 = 69, B4 = 71, D5 = 74, Fs5 = 78, A5 = 81, B5 = 83, D6 = 86;
const A3 = 57, B3 = 59, G3 = 55, D3 = 50;

const RESEP: Record<JenisBunyi, Resep> = {
  kartu: (k, t, { p, v }) => {
    gesek(k, t, 0.075, { frek: 2500 * p, frekAkhir: 3300 * p, q: 1.1, puncak: 0.5 * v });
    ketuk(k, t + 0.06, { puncak: 0.2 * v, badan: 210 * p, terang: 3000 * p });
    return 0.15;
  },
  bagi: (k, t, { p, v }) => {
    gesek(k, t, 0.05, { frek: 3000 * p, frekAkhir: 3800 * p, q: 1.3, puncak: 0.38 * v });
    ketuk(k, t + 0.042, { puncak: 0.15 * v, badan: 230 * p, terang: 3400 * p });
    return 0.12;
  },
  kocok: (k, t, { p, v }) => {
    // Riffle: dua belahan deck saling menyisip, puluhan klik kertas yang rapat lalu merenggang.
    const n = 30;
    const waktu = Array.from({ length: n }, (_, i) => t + 0.42 * (i / n) ** 0.92 + acak(-0.002, 0.002)).sort((x, y) => x - y);
    gemeretak(k, waktu, {
      frekMin: 2200 * p,
      frekMaks: 5200 * p,
      puncak: (i) => 0.32 * v * Math.sin((Math.PI * (i + 0.5)) / n) ** 0.6 * acak(0.6, 1),
    });
    // Kartu menyatu ("bridge") lalu dirapikan dengan diketuk ke meja.
    gesek(k, t + 0.43, 0.11, { frek: 1900 * p, frekAkhir: 1200 * p, q: 0.8, puncak: 0.12 * v, serang: 0.02 });
    ketuk(k, t + 0.56, { puncak: 0.2 * v, badan: 160 * p, terang: 1800 * p });
    return 0.66;
  },
  balik: (k, t, { p, v }) => {
    gesek(k, t, 0.06, { frek: 1400 * p, frekAkhir: 4200 * p, q: 1.4, puncak: 0.42 * v, serang: 0.014 });
    ketuk(k, t + 0.052, { puncak: 0.14 * v, badan: 250 * p, terang: 3600 * p });
    return 0.13;
  },
  angkat: (k, t, { p, v }) => {
    gesek(k, t, 0.035, { frek: 3800 * p, frekAkhir: 4600 * p, q: 1.5, puncak: 0.17 * v, serang: 0.008 });
    return 0.05;
  },
  letak: (k, t, { p, v }) => {
    ketuk(k, t, { puncak: 0.45 * v, badan: 160 * p, terang: 2000 * p });
    gesek(k, t, 0.03, { frek: 1400 * p, q: 1, puncak: 0.13 * v, serang: 0.002 });
    return 0.1;
  },
  geser: (k, t, { p, v }) => {
    gesek(k, t, 0.09, { frek: 2000 * p, frekAkhir: 1700 * p, q: 0.9, puncak: 0.29 * v, serang: 0.02 });
    return 0.1;
  },
  buang: (k, t, { p, v }) => {
    gesek(k, t, 0.09, { frek: 2800 * p, frekAkhir: 1700 * p, q: 1, puncak: 0.26 * v, serang: 0.006 });
    ketuk(k, t + 0.08, { puncak: 0.3 * v, badan: 150 * p, terang: 1900 * p });
    return 0.2;
  },
  mulung: (k, t, { p, pn, v }) => {
    // Kartu dikumpulkan dari buangan, lalu dua nada naik yang riang.
    const waktu = [0, 0.03, 0.055, 0.085, 0.11, 0.14].map((d) => t + d + acak(0, 0.006));
    gemeretak(k, waktu, { frekMin: 2000 * p, frekMaks: 4200 * p, puncak: () => 0.22 * v * acak(0.7, 1) });
    gesek(k, t, 0.16, { frek: 2200 * p, frekAkhir: 3600 * p, q: 0.9, puncak: 0.22 * v, serang: 0.03 });
    bilah(k, t + 0.12, hz(A4) * pn, 0.35, 0.19 * v);
    bilah(k, t + 0.21, hz(D5) * pn, 0.5, 0.19 * v);
    return 0.75;
  },
  giliran: (k, t, { pn, v }) => {
    bilah(k, t, hz(A4) * pn, 0.5, 0.19 * v);
    bilah(k, t + 0.13, hz(D5) * pn, 0.75, 0.19 * v);
    return 0.9;
  },
  sorak: (k, t, { pn, v }) => {
    tak(k, t, 0.22 * v);
    tak(k, t + 0.09, 0.17 * v);
    dung(k, t + 0.18, 0.28 * v);
    [D5, Fs5, A5, D6].forEach((m, i) => bilah(k, t + i * 0.07, hz(m) * pn, 0.45, 0.1 * v));
    return 0.85;
  },
  mentung: (k, t, { pn, v }) => {
    // Puncak: kendang dihentak, gong kecil, dan akord bilah terbuka.
    dung(k, t, 0.4 * v, 100);
    tak(k, t, 0.14 * v);
    gong(k, t + 0.02, hz(D3) * pn, 1.8, 0.2 * v);
    [D5, Fs5, A5].forEach((m, i) => bilah(k, t + 0.05 + i * 0.035, hz(m) * pn, 0.9, 0.09 * v));
    return 1.9;
  },
  kepentung: (k, t, { pn, v }) => {
    // "Aduh": tiga nada turun pelan, lalu dentum rendah. Sendu, bukan mengejek.
    [A4, Fs4, D4].forEach((m, i) => bilah(k, t + i * 0.18, hz(m) * pn, 0.6, 0.15 * v));
    nada(k, t + 0.36, hz(D4) * pn, 0.7, { tipe: 'triangle', puncak: 0.06 * v, geserKe: hz(D4 - 0.5) * pn, lowpass: 1200, serang: 0.03 });
    dung(k, t + 0.36, 0.22 * v, 90);
    return 1.1;
  },
  bahaya: (k, t, { pn, v }) => {
    bilah(k, t, hz(B5) * pn, 0.26, 0.15 * v, 0.2);
    bilah(k, t + 0.16, hz(B5) * pn, 0.32, 0.15 * v, 0.2);
    return 0.5;
  },
  joker: (k, t, { pn, v }) => {
    // Seruan jenaka "waduh": luncuran turun yang lembut + ketukan kendang.
    nada(k, t, 760 * pn, 0.32, { tipe: 'triangle', puncak: 0.28 * v, geserKe: 260 * pn, lowpass: 2400, gema: 0.25 });
    tak(k, t, 0.22 * v);
    bilah(k, t + 0.3, hz(E4) * pn, 0.35, 0.14 * v);
    return 0.7;
  },
  tegang: (k, t, { v }) => {
    // Gebukan kendang yang makin rapat dan makin keras, seperti sebelum kartu dibuka.
    for (let i = 0; i < 9; i++) {
      const ti = t + 0.05 + i * 0.11 - i * i * 0.004;
      tak(k, ti, (0.07 + i * 0.018) * v);
      if (i % 3 === 0) dung(k, ti, (0.1 + i * 0.012) * v, 110 + i * 4);
    }
    return 0.8;
  },
  detak: (k, t, { v }) => {
    // Dua denyut rendah; harmoniknya supaya tetap terasa di speaker HP.
    nada(k, t, 64, 0.14, { puncak: 0.24 * v, serang: 0.006, geserKe: 48 });
    nada(k, t, 128, 0.1, { tipe: 'triangle', puncak: 0.14 * v, serang: 0.006, geserKe: 100, lowpass: 400 });
    nada(k, t + 0.2, 58, 0.15, { puncak: 0.18 * v, serang: 0.006, geserKe: 44 });
    nada(k, t + 0.2, 116, 0.1, { tipe: 'triangle', puncak: 0.1 * v, serang: 0.006, geserKe: 92, lowpass: 400 });
    return 0.4;
  },
  menang: (k, t, { pn, v }) => {
    tak(k, t, 0.18 * v);
    tak(k, t + 0.1, 0.16 * v);
    dung(k, t + 0.2, 0.28 * v);
    [D5, Fs5, A5].forEach((m, i) => bilah(k, t + 0.2 + i * 0.1, hz(m) * pn, 0.5, 0.11 * v));
    bilah(k, t + 0.55, hz(D6) * pn, 1.1, 0.12 * v, 0.45);
    // Akord hangat di belakang (D mayor), masuk pelan.
    [D4, Fs4, A4].forEach((m) => nada(k, t + 0.55, hz(m) * pn, 1.3, { tipe: 'triangle', puncak: 0.05 * v, serang: 0.08, lowpass: 1400, gema: 0.3 }));
    gong(k, t + 0.55, hz(D3) * pn, 1.6, 0.12 * v);
    return 2.2;
  },
  kalah: (k, t, { pn, v }) => {
    // Motif turun pelan di atas akord Bm: sendu, singkat, tidak mengejek.
    [B4, A4, Fs4, E4].forEach((m, i) => bilah(k, t + i * 0.24, hz(m) * pn, 0.6, 0.14 * v, 0.4));
    bilah(k, t + 0.96, hz(D4) * pn, 1.1, 0.15 * v, 0.45);
    [B3, D4, Fs4].forEach((m) => nada(k, t, hz(m) * pn, 1.5, { tipe: 'triangle', puncak: 0.035 * v, serang: 0.25, lowpass: 1000 }));
    nada(k, t + 0.96, hz(G3) * pn, 1.0, { tipe: 'triangle', puncak: 0.05 * v, serang: 0.1, lowpass: 700 });
    return 2.1;
  },
  pop: (k, t, { p, v }) => {
    nada(k, t, 520 * p, 0.08, { puncak: 0.23 * v, serang: 0.003, geserKe: 900 * p });
    return 0.1;
  },
  klik: (k, t, { p, v }) => {
    gesek(k, t, 0.008, { frek: 4500 * p, q: 3, puncak: 0.45 * v, serang: 0.0008 });
    nada(k, t, 1900 * p, 0.02, { puncak: 0.06 * v, serang: 0.001 });
    return 0.03;
  },
  tolak: (k, t, { pn, v }) => {
    // "Eh-eh" yang teredam: dua ketukan rendah turun, bukan dengung buzzer.
    nada(k, t, hz(A3) * pn, 0.09, { tipe: 'triangle', puncak: 0.2 * v, serang: 0.004, lowpass: 800 });
    nada(k, t + 0.11, hz(G3) * pn, 0.12, { tipe: 'triangle', puncak: 0.17 * v, serang: 0.004, lowpass: 700 });
    return 0.25;
  },
  notifikasi: (k, t, { pn, v }) => {
    bilah(k, t, hz(D5) * pn, 0.4, 0.14 * v);
    bilah(k, t + 0.09, hz(A5) * pn, 0.5, 0.11 * v);
    return 0.6;
  },
};

/** Jarak minimal (ms) antar bunyi sejenis; yang lebih rapat dibuang, bukan ditunda. */
const JEDA_MIN: Partial<Record<JenisBunyi, number>> = {
  kartu: 35,
  bagi: 30,
  letak: 30,
  angkat: 40,
  geser: 50,
  balik: 40,
  klik: 40,
  pop: 60,
  giliran: 300,
  detak: 500,
  kocok: 500,
  tegang: 500,
  mentung: 800,
  kepentung: 800,
  menang: 1000,
  kalah: 1000,
};
const JEDA_BAWAAN = 70;

/** Maksimal bunyi yang boleh tumpang tindih; bunyi penting tetap lolos. */
const MAKS_POLIFONI = 8;
const PENTING: ReadonlySet<JenisBunyi> = new Set(['giliran', 'mentung', 'kepentung', 'menang', 'kalah', 'tegang']);

/** Kapan tiap jenis terakhir diputar (performance.now), dan kapan bunyi yang sedang jalan selesai (waktu audio). */
const terakhirPutar = new Map<JenisBunyi, number>();
let sedangBerbunyi: { akhir: number }[] = [];

function variasi(opsi: OpsiBunyi): Variasi {
  const naik = 2 ** (Math.min(12, Math.max(0, opsi.urutan ?? 0)) / 12);
  return { p: acak(0.94, 1.06) * naik, pn: acak(0.995, 1.005) * naik, v: acak(0.85, 1) };
}

/** Browser baru mengizinkan audio setelah ada sentuhan pertama: pasang pembuka audio dan musik latar. */
export function siapkanAudio(): void {
  pasangMesinAudio();
  pasangMusik();
}

/** Putar satu efek suara. Diam saja kalau suara dimatikan, tab tersembunyi, atau audio belum dibuka. */
export function bunyi(jenis: JenisBunyi, opsi: OpsiBunyi = {}): void {
  if (!preferensi().suara) return;
  const r = mesinAudio();
  if (!r || !bisaBersuara(r)) return;
  const kini = performance.now();
  const lalu = terakhirPutar.get(jenis);
  if (lalu !== undefined && kini - lalu < (JEDA_MIN[jenis] ?? JEDA_BAWAAN)) return;
  const t = r.a.currentTime;
  sedangBerbunyi = sedangBerbunyi.filter((b) => b.akhir > t);
  if (sedangBerbunyi.length >= MAKS_POLIFONI && !PENTING.has(jenis)) return;
  terakhirPutar.set(jenis, kini);
  const mulai = t + 0.005;
  const durasi = RESEP[jenis](keluaranEfek(r), mulai, variasi(opsi));
  sedangBerbunyi.push({ akhir: mulai + durasi });
}

/**
 * Rekam satu bunyi secara offline (volume efek 100%) untuk memeriksa level puncak dan durasi.
 * Hanya alat ukur (skrip uji/konsol dev); tidak dipakai saat main.
 */
export async function rekamBunyi(jenis: JenisBunyi, opsi: OpsiBunyi = {}): Promise<AudioBuffer> {
  const laju = 48000;
  const a = new OfflineAudioContext(2, laju * 3.5, laju);
  const r = bangunRantai(a);
  r.busMusik.gain.value = 0;
  RESEP[jenis](keluaranEfek(r), 0.02, variasi(opsi));
  return a.startRendering();
}

// ---------- getar ----------

/** Pola getar bernama (ms). Pakai nama ini supaya rasa getar konsisten di seluruh aplikasi. */
export const POLA_GETAR = {
  /** Tekan tombol/kartu. */
  ketuk: 8,
  /** Kartu mendarat di tanganmu. */
  letak: 12,
  /** Aksi tidak sah. */
  tolak: [12, 40, 12],
  /** Giliranmu. */
  giliran: 35,
  /** Pemberitahuan lembut. */
  notifikasi: [15, 50, 15],
  /** Kejadian publik yang perlu diwaspadai (kartumu dipungut, lawan tinggal 1 kartu). */
  bahaya: [30, 60, 30],
  /** Kamu mentung. */
  mentung: [40, 50, 90],
  /** Kamu kepentung. */
  kepentung: [90, 60, 140],
  /** Menang permainan. */
  menang: [30, 50, 30, 50, 80],
} as const satisfies Record<string, number | readonly number[]>;

export type NamaPolaGetar = keyof typeof POLA_GETAR;

/** Pola yang tetap lolos walau baru saja ada getar lain. */
const GETAR_PENTING: ReadonlySet<NamaPolaGetar> = new Set(['mentung', 'kepentung', 'menang']);
let getarTerakhir = 0;

/** True kalau HP ini bisa bergetar (iPhone/Safari tidak). UI bisa menyembunyikan setelan getar. */
export function getarDidukung(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Getarkan HP. Menerima nama pola (disarankan) atau pola mentah ms.
 * Menghormati preferensi getar; saat gerak dikurangi, pola panjang dipangkas jadi satu denyut pendek.
 */
export function getar(pola: NamaPolaGetar | number | readonly number[]): void {
  if (!preferensi().getar || !getarDidukung()) return;
  // Browser memblokir getar sebelum ada sentuhan dan saat halaman tidak terlihat.
  if (document.visibilityState !== 'visible' || navigator.userActivation?.hasBeenActive === false) return;
  const penting = typeof pola === 'string' && GETAR_PENTING.has(pola);
  const kini = performance.now();
  if (!penting && kini - getarTerakhir < 80) return;
  getarTerakhir = kini;
  const mentah = typeof pola === 'string' ? POLA_GETAR[pola] : pola;
  let akhir: number | number[] = typeof mentah === 'number' ? mentah : [...mentah];
  if (gerakDikurangi()) akhir = Math.min(30, typeof akhir === 'number' ? akhir : akhir[0] ?? 0);
  try {
    navigator.vibrate(akhir);
  } catch {
    // Tidak didukung: abaikan.
  }
}
