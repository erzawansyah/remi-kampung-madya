// Preferensi pemain di HP ini: suara, musik, getar, gerak, kecepatan animasi, tampilan.
// Murni presentasi: tidak ada satu pun yang menyentuh aturan main.
// Disimpan di localStorage (remi.preferensi). Simpanan lama remi.efek ({suara, getar}) ikut terbaca.

export type PilihanGerak = 'ikutSistem' | 'penuh' | 'kurang';
export type KecepatanAnimasi = 'santai' | 'normal' | 'cepat';
export type IntensitasEfek = 'lengkap' | 'hemat';
export type WarnaKartu = 'dua' | 'empat';
export type UkuranTeks = 'normal' | 'besar';

export interface Preferensi {
  /** Efek suara nyala/mati. */
  suara: boolean;
  /** Volume efek suara, 0..1. */
  volumeEfek: number;
  /** Musik latar nyala/mati. Bawaan mati supaya tidak bikin capek. */
  musik: boolean;
  /** Volume musik latar, 0..1. */
  volumeMusik: number;
  /** Getar HP (Vibration API; tidak didukung di iPhone). */
  getar: boolean;
  /** Gerak: ikut setelan sistem (prefers-reduced-motion), penuh, atau dikurangi. */
  gerak: PilihanGerak;
  /** Kecepatan animasi kartu. */
  kecepatan: KecepatanAnimasi;
  /** Intensitas efek visual: lengkap, atau hemat untuk HP lemah. */
  efek: IntensitasEfek;
  /** Kartu dua warna (klasik) atau empat warna (tiap bunga beda warna). */
  warnaKartu: WarnaKartu;
  /** Ukuran teks antarmuka. */
  ukuranTeks: UkuranTeks;
  /** Tutorial permainan pertama sudah selesai/dilewati. */
  tutorialSelesai: boolean;
}

export const PREFERENSI_BAWAAN: Readonly<Preferensi> = Object.freeze({
  suara: true,
  volumeEfek: 0.8,
  musik: false,
  volumeMusik: 0.35,
  getar: true,
  gerak: 'ikutSistem',
  kecepatan: 'normal',
  efek: 'lengkap',
  warnaKartu: 'dua',
  ukuranTeks: 'normal',
  tutorialSelesai: false,
});

const KUNCI = 'remi.preferensi';
const KUNCI_LAMA = 'remi.efek';

function bacaJson(kunci: string): unknown {
  try {
    const x = localStorage.getItem(kunci);
    return x === null ? null : JSON.parse(x);
  } catch {
    return null;
  }
}

const pilih = <T extends string>(nilai: unknown, daftar: readonly T[], bawaan: T): T =>
  typeof nilai === 'string' && (daftar as readonly string[]).includes(nilai) ? (nilai as T) : bawaan;
const angka01 = (nilai: unknown, bawaan: number): number =>
  typeof nilai === 'number' && Number.isFinite(nilai) ? Math.min(1, Math.max(0, nilai)) : bawaan;
const bool = (nilai: unknown, bawaan: boolean): boolean => (typeof nilai === 'boolean' ? nilai : bawaan);

/** Bersihkan data mentah dari penyimpanan supaya selalu jadi Preferensi yang sah. */
export function normalkan(mentah: unknown): Preferensi {
  const m = (mentah && typeof mentah === 'object' ? mentah : {}) as Record<string, unknown>;
  const b = PREFERENSI_BAWAAN;
  return {
    suara: bool(m.suara, b.suara),
    volumeEfek: angka01(m.volumeEfek, b.volumeEfek),
    musik: bool(m.musik, b.musik),
    volumeMusik: angka01(m.volumeMusik, b.volumeMusik),
    getar: bool(m.getar, b.getar),
    gerak: pilih(m.gerak, ['ikutSistem', 'penuh', 'kurang'] as const, b.gerak),
    kecepatan: pilih(m.kecepatan, ['santai', 'normal', 'cepat'] as const, b.kecepatan),
    efek: pilih(m.efek, ['lengkap', 'hemat'] as const, b.efek),
    warnaKartu: pilih(m.warnaKartu, ['dua', 'empat'] as const, b.warnaKartu),
    ukuranTeks: pilih(m.ukuranTeks, ['normal', 'besar'] as const, b.ukuranTeks),
    tutorialSelesai: bool(m.tutorialSelesai, b.tutorialSelesai),
  };
}

let cache: Preferensi | null = null;
const pendengar = new Set<(p: Preferensi) => void>();

/** Preferensi saat ini (selalu lengkap dan sah). */
export function preferensi(): Preferensi {
  if (!cache) {
    const baru = bacaJson(KUNCI);
    // Simpanan lama hanya punya {suara, getar}; dipakai sebagai dasar kalau belum ada yang baru.
    cache = normalkan(baru ?? bacaJson(KUNCI_LAMA));
  }
  return cache;
}

/** Ubah sebagian preferensi, simpan, terapkan ke dokumen, lalu kabari pendengar. */
export function aturPreferensi(ubah: Partial<Preferensi>): Preferensi {
  cache = normalkan({ ...preferensi(), ...ubah });
  try {
    localStorage.setItem(KUNCI, JSON.stringify(cache));
  } catch {
    // Abaikan: penyimpanan tidak tersedia, preferensi tetap berlaku sampai halaman ditutup.
  }
  terapkanKeDokumen();
  for (const cb of pendengar) {
    try {
      cb(cache);
    } catch (e) {
      console.error(e);
    }
  }
  return cache;
}

/** Daftarkan pendengar perubahan preferensi. Mengembalikan fungsi untuk berhenti mendengar. */
export function saatPreferensiBerubah(cb: (p: Preferensi) => void): () => void {
  pendengar.add(cb);
  return () => pendengar.delete(cb);
}

let mediaGerak: MediaQueryList | null = null;
function sistemMintaKurangGerak(): boolean {
  try {
    mediaGerak ??= window.matchMedia('(prefers-reduced-motion: reduce)');
    return mediaGerak.matches;
  } catch {
    return false;
  }
}

/** True kalau gerakan harus dikurangi (pilihan pemain, atau ikut setelan sistem). */
export function gerakDikurangi(p: Preferensi = preferensi()): boolean {
  return p.gerak === 'kurang' || (p.gerak === 'ikutSistem' && sistemMintaKurangGerak());
}

/**
 * Pengali durasi animasi dari pilihan kecepatan.
 * Gerak dikurangi tidak memperlambat; ia memendekkan dan menghilangkan gerakan besar (lihat gerak.ts).
 */
export function skalaWaktu(p: Preferensi = preferensi()): number {
  const dasar = p.kecepatan === 'cepat' ? 0.6 : p.kecepatan === 'santai' ? 1.3 : 1;
  return gerakDikurangi(p) ? Math.min(dasar, 0.6) : dasar;
}

/**
 * Pasang preferensi sebagai atribut di <html> supaya CSS bisa bereaksi:
 * data-gerak="kurang|penuh", data-efek, data-warna-kartu, data-teks.
 */
export function terapkanKeDokumen(p: Preferensi = preferensi()): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.dataset.gerak = gerakDikurangi(p) ? 'kurang' : 'penuh';
  el.dataset.efek = p.efek;
  el.dataset.warnaKartu = p.warnaKartu;
  el.dataset.teks = p.ukuranTeks;
}

/** Panggil sekali saat aplikasi mulai: terapkan atribut dan ikuti perubahan setelan sistem. */
export function pasangPreferensi(): void {
  terapkanKeDokumen();
  try {
    mediaGerak ??= window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaGerak.addEventListener('change', () => {
      terapkanKeDokumen();
      for (const cb of pendengar) cb(preferensi());
    });
  } catch {
    // matchMedia tidak tersedia: abaikan.
  }
}

/** Hanya untuk test: lupakan cache supaya preferensi dibaca ulang dari penyimpanan. */
export function _setelUlangCache(): void {
  cache = null;
}
