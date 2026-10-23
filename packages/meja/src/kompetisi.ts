// Aturan kompetisi (keputusan pemilik #51, 23 Okt 2026). Satu sumber untuk server (penyimpan
// kompetisi di SQLite, apps/server/src/kompetisi.ts) dan layar Kompetisi di HP. Murni: tanpa DOM,
// tanpa Node API, tanpa jam sendiri (waktu selalu diberikan pemanggil, ms epoch).
//
// Ringkasnya:
// - Siapa saja boleh mengajukan kompetisi. Jalan begitu MIN_PESERTA orang (termasuk pengaju) menekan
//   "Ikut serta"; 24 jam belum cukup = batal sendiri. Ikut serta boleh sampai kompetisi selesai.
// - Masa berlaku (1 malam, 1 minggu, 1 bulan) dihitung sejak kompetisi jalan.
// - Hanya permainan di meja kompetisi yang dihitung: semua kursi peserta, tanpa warga kedai, dan
//   pengaturan aturannya dikunci dari kompetisi.
// - Poin satu permainan = banyaknya peserta lain di meja itu yang kamu kalahkan (meja 4 orang 3-2-1-0).
//   Yang keluar di tengah permainan juru kunci (0 poin), sama seperti leaderboard #45.
// - Klasemen: total poin, minimal MIN_MAIN_KOMPETISI kali main; seri = rata-rata poin, lalu rata-rata
//   skor akhir.
// - Selesai lebih awal kalau lebih dari separuh peserta setuju.

import { nilaiEfektif, type KursiPeringkat } from './peringkat.js';
import { PENGATURAN_BAWAAN, type PengaturanMeja } from './protokol.js';
import { batasSkorSah, isLevel } from './validasi.js';

/** Peserta minimal (termasuk pengaju) supaya kompetisi jalan. */
export const MIN_PESERTA = 4;
/** Pengajuan yang belum cukup peserta sesudah sekian ms batal sendiri. */
export const BATAS_PENGAJUAN_MS = 24 * 60 * 60 * 1000;
/** Minimal main supaya masuk klasemen (sama dengan leaderboard #45). */
export const MIN_MAIN_KOMPETISI = 3;
/** Batas peserta satu kompetisi (jaga-jaga, bukan aturan main). */
export const MAKS_PESERTA = 100;

export const DAFTAR_MASA = ['malam', 'minggu', 'bulan'] as const;
export type MasaKompetisi = (typeof DAFTAR_MASA)[number];

export const isMasa = (x: unknown): x is MasaKompetisi => (DAFTAR_MASA as readonly unknown[]).includes(x);

/**
 * Pengaturan meja yang dikunci kompetisi: semua yang memengaruhi aturan dan kekuatan permainan.
 * Level warga kedai ikut dikunci karena giliran pemain yang terputus atau kehabisan waktu tetap
 * dijalankan warga kedai. Jumlah pemain, publik, dan tempo bebas diatur host.
 */
export const KUNCI_PENGATURAN_KOMPETISI = [
  'duaDeckUntukEmpat',
  'batasPutaran',
  'batasSkorAtas',
  'batasSkorBawah',
  'modeKaldu',
  'detikGiliran',
  'levelBot',
] as const satisfies readonly (keyof PengaturanMeja)[];

export type KunciPengaturanKompetisi = (typeof KUNCI_PENGATURAN_KOMPETISI)[number];
export type PengaturanKompetisi = Required<Pick<PengaturanMeja, KunciPengaturanKompetisi>>;

export const PENGATURAN_KOMPETISI_BAWAAN: Readonly<PengaturanKompetisi> = {
  duaDeckUntukEmpat: PENGATURAN_BAWAAN.duaDeckUntukEmpat,
  batasPutaran: PENGATURAN_BAWAAN.batasPutaran,
  batasSkorAtas: PENGATURAN_BAWAAN.batasSkorAtas,
  batasSkorBawah: PENGATURAN_BAWAAN.batasSkorBawah,
  modeKaldu: false,
  detikGiliran: PENGATURAN_BAWAAN.detikGiliran,
  levelBot: PENGATURAN_BAWAAN.levelBot,
};

/**
 * Pengaturan kompetisi dari data yang tidak dipercaya (isian, JSON di database): tiap kunci yang
 * tidak sah jatuh ke bawaan masing-masing, kunci lain dibuang. Tidak pernah melempar.
 */
export function rapikanPengaturanKompetisi(x: unknown): PengaturanKompetisi {
  const o = typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {};
  const b = PENGATURAN_KOMPETISI_BAWAAN;
  const bulat = (v: unknown, min: number, maks: number): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= maks;
  return {
    duaDeckUntukEmpat: typeof o.duaDeckUntukEmpat === 'boolean' ? o.duaDeckUntukEmpat : b.duaDeckUntukEmpat,
    batasPutaran: o.batasPutaran === null || bulat(o.batasPutaran, 1, 100000) ? (o.batasPutaran as number | null) : b.batasPutaran,
    batasSkorAtas: batasSkorSah(o.batasSkorAtas, 'atas') ? o.batasSkorAtas : b.batasSkorAtas,
    batasSkorBawah: batasSkorSah(o.batasSkorBawah, 'bawah') ? o.batasSkorBawah : b.batasSkorBawah,
    modeKaldu: typeof o.modeKaldu === 'boolean' ? o.modeKaldu : b.modeKaldu,
    detikGiliran: bulat(o.detikGiliran, 0, 600) ? o.detikGiliran : b.detikGiliran,
    levelBot: isLevel(o.levelBot) ? o.levelBot : b.levelBot,
  };
}

/** Kunci pengaturan yang ikut diubah di `ubah` padahal dikunci kompetisi (nilainya berbeda). */
export function ubahanTerkunci(kunci: Readonly<PengaturanKompetisi>, ubah: Partial<PengaturanMeja>): KunciPengaturanKompetisi[] {
  return KUNCI_PENGATURAN_KOMPETISI.filter((k) => k in ubah && ubah[k] !== kunci[k]);
}

const JAM_MS = 60 * 60 * 1000;
const HARI_MS = 24 * JAM_MS;
const WIB_MS = 7 * JAM_MS;
/** "1 malam" berakhir pukul 06.00 WIB, paling cepat sekian jam sesudah kompetisi jalan. */
const JAM_AKHIR_MALAM = 6;
const MIN_JAM_MALAM = 3;

/**
 * Kapan kompetisi berakhir (ms epoch), dihitung dari saat jalan:
 * - malam: pukul 06.00 WIB berikutnya yang paling cepat 3 jam lagi (jalan 05.00 → besoknya 06.00),
 * - minggu: 7 × 24 jam, bulan: 30 × 24 jam.
 */
export function akhirKompetisi(masa: MasaKompetisi, mulai: number): number {
  if (masa === 'minggu') return mulai + 7 * HARI_MS;
  if (masa === 'bulan') return mulai + 30 * HARI_MS;
  const t = new Date(mulai + WIB_MS);
  let akhir = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), JAM_AKHIR_MALAM) - WIB_MS;
  while (akhir < mulai + MIN_JAM_MALAM * JAM_MS) akhir += HARI_MS;
  return akhir;
}

export type StatusKompetisi = 'pengajuan' | 'batal' | 'berjalan' | 'selesai';

export interface WaktuKompetisi {
  diajukanPada: number;
  /** null = masih pengajuan (peserta belum cukup). */
  mulaiPada: number | null;
  /** null = belum jalan. */
  berakhirPada: number | null;
  /** Ditutup lebih awal lewat voting peserta. */
  ditutupPada: number | null;
}

export function statusKompetisi(k: WaktuKompetisi, sekarang: number): StatusKompetisi {
  if (k.mulaiPada === null) return sekarang >= k.diajukanPada + BATAS_PENGAJUAN_MS ? 'batal' : 'pengajuan';
  if (k.ditutupPada !== null || (k.berakhirPada !== null && sekarang >= k.berakhirPada)) return 'selesai';
  return 'berjalan';
}

/** Kapan kompetisi yang sudah selesai berakhir (tutup lebih awal atau masa habis); null = belum. */
export function selesaiPada(k: WaktuKompetisi): number | null {
  return k.ditutupPada ?? k.berakhirPada;
}

/** Voting tutup lebih awal lolos: lebih dari separuh peserta setuju. */
export const tutupDisetujui = (setuju: number, peserta: number): boolean => peserta > 0 && setuju * 2 > peserta;

/**
 * Poin tiap kursi satu permainan kompetisi (urutan sama dengan masukan): banyaknya kursi lain yang
 * peringkat efektifnya lebih buruk. Skor sama = tidak saling mengalahkan. Yang keluar di tengah
 * permainan selalu juru kunci (`nilaiEfektif`), jadi poinnya 0 dan ia dikalahkan semua yang bertahan.
 */
export function poinKompetisi(pemain: readonly KursiPeringkat[]): number[] {
  const nilai = nilaiEfektif(pemain);
  return nilai.map((v, i) => nilai.filter((w, j) => j !== i && w.peringkat > v.peringkat).length);
}

/** Satu baris hasil: satu peserta di satu permainan kompetisi. */
export interface HasilKompetisi {
  peserta: number;
  poin: number;
  /** Skor efektif (yang keluar: skor terendah di meja), sama dengan leaderboard. */
  skor: number;
  juara: boolean;
  keluar: boolean;
}

export interface PesertaKompetisi {
  id: number;
  nama: string;
}

export interface BarisKompetisi {
  id: number;
  nama: string;
  main: number;
  poin: number;
  juara: number;
  keluar: number;
  /** poin ÷ main, belum dibulatkan (0 kalau belum main). */
  rataPoin: number;
  /** Σ skor ÷ main, belum dibulatkan (0 kalau belum main). */
  rataSkor: number;
}

const turun = (a: number, b: number) => (a > b ? -1 : a < b ? 1 : 0);
const abjad = (a: BarisKompetisi, b: BarisKompetisi) =>
  a.nama.localeCompare(b.nama, 'id') || (a.nama < b.nama ? -1 : a.nama > b.nama ? 1 : 0);

/**
 * Klasemen kompetisi. Peserta yang sudah main minimal MIN_MAIN_KOMPETISI kali masuk `peringkat`
 * (total poin, lalu rata-rata poin, lalu rata-rata skor, lalu abjad); sisanya `belumCukup` (paling
 * sering main dulu). Hasil milik peserta yang tidak dikenal dilewati.
 */
export function hitungKlasemenKompetisi(
  peserta: readonly PesertaKompetisi[],
  hasil: readonly HasilKompetisi[],
): { peringkat: BarisKompetisi[]; belumCukup: BarisKompetisi[] } {
  const per = new Map<number, BarisKompetisi & { totalSkor: number }>();
  for (const p of peserta) {
    per.set(p.id, { id: p.id, nama: p.nama, main: 0, poin: 0, juara: 0, keluar: 0, rataPoin: 0, rataSkor: 0, totalSkor: 0 });
  }
  for (const h of hasil) {
    const b = per.get(h.peserta);
    if (!b) continue;
    b.main++;
    b.poin += h.poin;
    b.totalSkor += h.skor;
    if (h.juara) b.juara++;
    if (h.keluar) b.keluar++;
  }
  const baris = [...per.values()].map(({ totalSkor, ...b }) => ({
    ...b,
    rataPoin: b.main ? b.poin / b.main : 0,
    rataSkor: b.main ? totalSkor / b.main : 0,
  }));
  return {
    peringkat: baris
      .filter((b) => b.main >= MIN_MAIN_KOMPETISI)
      .sort((a, b) => turun(a.poin, b.poin) || turun(a.rataPoin, b.rataPoin) || turun(a.rataSkor, b.rataSkor) || abjad(a, b)),
    belumCukup: baris
      .filter((b) => b.main < MIN_MAIN_KOMPETISI)
      .sort((a, b) => turun(a.main, b.main) || turun(a.poin, b.poin) || abjad(a, b)),
  };
}
