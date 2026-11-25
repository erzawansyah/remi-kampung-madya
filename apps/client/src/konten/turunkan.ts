// Teks tombol Turunkan (keputusan pemilik #63). Tombolnya selalu bisa ditekan di giliran sendiri dan
// di susun akhir; kalau kartu yang dipilih belum jadi kartu jadi, penolakannya SATU pesan yang sama
// untuk semua alasan, supaya alasan penolakan tidak bisa dipakai menebak joker. Penjelasan aturannya
// tetap di Bantuan. Data saja; dijaga apps/client/test/antislop.test.ts.

export const TEKS_TURUNKAN = {
  /** Kurang dari 3 kartu dipilih (jumlah pilihan terlihat sendiri, bukan rahasia). */
  minimalTiga: 'Pilih minimal 3 kartu.',
  /** 3 kartu atau lebih yang belum jadi kartu jadi, apa pun sebabnya. */
  belumJadi: 'Belum jadi kartu jadi, Bos.',
  /** Jendela pilih susunan (tanpa Batal: pilihan langsung dipakai). */
  judulPeran: 'Joker-nya jadi apa?',
  ketPeran: 'Kombinasi ini bisa dibaca lebih dari satu cara. Pilih salah satu.',
} as const;
