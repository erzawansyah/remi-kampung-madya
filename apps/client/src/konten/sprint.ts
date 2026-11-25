// Teks layar Sprint dan meja sprint (keputusan pemilik 25 Nov 2026). Data saja; aturan sprint
// (pengaturan, hasil, urutan papan, juara mingguan) hanya di @remi/meja (sprint.ts). Dijaga
// apps/client/test/antislop.test.ts.

import { JUMLAH_PUTARAN_SPRINT, type KolomSprint } from '@remi/meja';

export const TEKS_SPRINT = {
  judul: 'Sprint',
  /** Tombol di panel Main online beranda. */
  tombolBeranda: 'Sprint',
  /** Satu kalimat pembuka di layar Sprint. */
  intro: `${JUMLAH_PUTARAN_SPRINT} putaran lawan 3 warga kedai level Suhu, kartunya diacak tiap main.`,
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
  /** Bar atas meja sprint (diikuti "Putaran N/5"). */
  labelAtas: 'Sprint',
  /** Menu ☰ di meja sprint. */
  menuMeja: `Sprint: ${JUMLAH_PUTARAN_SPRINT} putaran lawan 3 warga kedai level Suhu. Aturannya dikunci, yang bisa diganti cuma tempo warga kedai (Pengaturan).`,
  /** Klasemen akhir meja sprint. */
  judulHasil: 'Hasil sprint',
  menang: 'Menang!',
  kalah: 'Belum menang',
  ketMenang: 'Skor akhirmu nggak kalah dari ketiga warga kedai.',
  ketKalah: 'Ada warga kedai yang skornya di atasmu.',
  labelSkor: 'Skor',
  labelMentung: 'Mentung',
  labelKepentung: 'Kepentung',
  /** Sebelum pesan sprintHasil datang dari server. */
  mencatat: 'Lagi dicatat di papan…',
  sprintLagi: 'Sprint lagi',
  keBeranda: 'Ke beranda',
  /** Konfirmasi keluar meja sprint (lewat opsiKonfirmasiKeluar). */
  keluarMain: 'Percobaan sprint ini berhenti di sini. Tetap dicatat di papan dengan putaran yang sudah selesai, tapi nggak dihitung menang.',
  keluarSelesai: 'Hasil sprint ini sudah dicatat di papan.',
} as const;

/** Posisi di papan minggu ini, dari pesan sprintHasil. */
export const teksPeringkatMinggu = (n: number): string => `Peringkat ${n} minggu ini`;

/** Piala juara mingguan di samping nama: 🏆, 🏆2, … ('' kalau belum pernah). */
export const teksPiala = (n: number): string => (n > 0 ? (n === 1 ? '🏆' : `🏆${n}`) : '');
/** Untuk pembaca layar. */
export const ariaPiala = (n: number): string => (n === 1 ? 'juara sprint mingguan sekali' : `juara sprint mingguan ${n} kali`);
