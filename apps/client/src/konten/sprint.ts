// Teks layar Sprint dan meja sprint (keputusan pemilik 25 Nov 2026, diubah 26 Nov 2026: tanpa batas
// putaran, lima lawan, 2 deck). Data saja; aturan sprint (pengaturan, hasil per putaran, urutan papan,
// juara mingguan) hanya di @remi/meja (sprint.ts). Dijaga apps/client/test/antislop.test.ts.

import type { KolomSprint } from '@remi/meja';

export const TEKS_SPRINT = {
  judul: 'Sprint',
  /** Tombol di panel Main online beranda. */
  tombolBeranda: 'Sprint',
  /** Satu kalimat pembuka di layar Sprint. */
  intro: 'Lawan 5 warga kedai level Suhu pakai 2 deck. Main sepuasnya, tiap putaran langsung masuk papan.',
  tombolMain: 'Main sprint',
  /** Toast kalau tombol Sprint atau Main sprint diketuk tanpa internet. */
  butuhInternet: 'Sprint cuma bisa dimainkan online, Bos. Sambungkan internet dulu.',
  tabMinggu: 'Minggu ini',
  tabSemua: 'Sepanjang masa',
  kolomNama: 'Nama',
  kolom: { menang: 'Menang', mentung: 'Mentung', kepentung: 'Kepentung', skor: 'Skor' } satisfies Record<KolomSprint, string>,
  memuat: 'Memuat papan…',
  kosongMinggu: 'Belum ada yang sprint minggu ini. Jadi yang pertama, Bos.',
  kosongSemua: 'Belum ada yang sprint.',
  gagal: 'Papan sprint belum bisa dibuka. Cek sinyal lalu coba lagi.',
  offline: 'Kamu lagi offline. Papan sprint butuh internet.',
  cobaLagi: 'Coba lagi',
  /** Keterangan di bawah papan. */
  ketPapan: 'Minggu ini dihitung mulai Senin pukul 00.00 WIB. Juara tiap minggu dapat 🏆. Ketuk judul kolom buat mengurutkan.',
  kembali: '← Kembali ke beranda',
  lencanaKamu: 'kamu',
  /** Bar atas meja sprint (diikuti "Putaran N"). */
  labelAtas: 'Sprint',
  /** Menu ☰ di meja sprint. */
  menuMeja:
    'Sprint: lawan 5 warga kedai level Suhu, 2 deck, tanpa batas putaran. Tiap putaran yang selesai langsung masuk papan. Aturannya dikunci, yang bisa diganti cuma tempo warga kedai (Pengaturan).',
  /** Satu baris di hasil putaran meja sprint, sebelum pesan sprintHasil putaran itu datang dari server. */
  mencatat: 'Lagi dicatat di papan…',
  /** Hasil putaran meja sprint sesudah tercatat. */
  menangPutaran: 'Menang putaran ini, udah masuk papan.',
  kalahPutaran: 'Putaran ini udah masuk papan.',
  /** Klasemen akhir meja sprint (hanya meja sprint lama yang masih punya batas putaran). */
  papanSprint: 'Papan sprint',
  /** Konfirmasi keluar meja sprint (lewat opsiKonfirmasiKeluar). */
  keluarMain: 'Putaran yang sudah selesai udah masuk papan. Putaran yang lagi jalan nggak dihitung.',
  keluarSelesai: 'Hasil sprint ini sudah dicatat di papan.',
} as const;

/** Posisi di papan minggu ini, dari pesan sprintHasil. */
export const teksPeringkatMinggu = (n: number): string => `Peringkat ${n} minggu ini`;

/**
 * Baris hasil putaran `nomor` di meja sprint: dari pesan sprintHasil kalau sudah untuk putaran itu
 * (menang atau tidak, plus peringkat minggu ini), selain itu "Lagi dicatat di papan…".
 */
export function teksSprintPutaran(nomor: number, h: { putaran?: number; menang: boolean; peringkatMinggu: number | null } | null): string {
  if (!h || h.putaran !== nomor) return TEKS_SPRINT.mencatat;
  const dasar = h.menang ? TEKS_SPRINT.menangPutaran : TEKS_SPRINT.kalahPutaran;
  return typeof h.peringkatMinggu === 'number' ? `${dasar} ${teksPeringkatMinggu(h.peringkatMinggu)}.` : dasar;
}

/** Piala juara mingguan di samping nama: 🏆, 🏆2, … ('' kalau belum pernah). */
export const teksPiala = (n: number): string => (n > 0 ? (n === 1 ? '🏆' : `🏆${n}`) : '');
/** Untuk pembaca layar. */
export const ariaPiala = (n: number): string => (n === 1 ? 'juara sprint mingguan sekali' : `juara sprint mingguan ${n} kali`);
