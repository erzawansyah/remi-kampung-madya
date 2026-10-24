// Teks dialog Usul fitur (keputusan pemilik 24 Okt 2026). Data saja; batas isian dan pesan
// penolakannya di @remi/meja (usulan.ts), dipakai juga oleh server. Dijaga antislop.test.ts.

import { MAKS_ISI_USULAN } from '@remi/meja';

export const TEKS_USULAN = {
  /** Ubin di menu beranda dan tombol di Tentang. */
  ubin: 'Usul fitur',
  judul: 'Usul fitur',
  pembuka: 'Punya ide atau nemu yang aneh? Tulis di sini. Usulanmu dibaca dan ditinjau tiap hari.',
  /** Diikuti nama pemain, mis. "Dikirim sebagai Ani." */
  dikirimSebagai: 'Dikirim sebagai',
  labelJenis: 'Jenis',
  /** Pilihan kosong (boleh); pilihan lain = DAFTAR_JENIS_USULAN apa adanya, sama dengan opsi di Notion. */
  pilihJenis: 'Pilih jenis',
  labelJudul: 'Judul',
  contohJudul: 'misal: Tambah mode turnamen',
  labelIsi: 'Ceritakan usulanmu',
  contohIsi: 'Idenya apa, atau apa yang aneh dan kapan kejadiannya.',
  /** Penghitung huruf di bawah isian, mis. "120/1000". */
  maksIsi: `/${MAKS_ISI_USULAN}`,
  kirim: 'Kirim',
  mengirim: 'Mengirim…',
  batal: 'Batal',
  tutup: 'Tutup',
  oke: 'Oke',
  /** Belum ada nama tersimpan (dibuka dari Tentang sebelum nama diisi). */
  belumAdaNama: 'Isi namamu dulu di beranda, lalu buka Usul fitur lagi.',
  offline: 'Lagi offline, Bos. Tulisanmu masih di sini, kirim lagi kalau sinyal sudah ada.',
  gagalJaringan: 'Server belum bisa dihubungi. Tulisanmu masih di sini, coba kirim lagi sebentar lagi.',
  gagalLain: 'Usulanmu belum terkirim. Coba lagi sebentar lagi, Bos.',
  terkirim: 'Makasih, usulanmu sudah masuk.',
} as const;

