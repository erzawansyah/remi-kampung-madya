// Teks mode kaldu (keputusan pemilik #42, #43): kotak centang di Atur meja dan lobi, plus teks
// pendek di meja. Pemilik minta teks di meja sesingkat mungkin, jadi di meja cuma label dan satu
// baris; penjelasan lengkapnya di Bantuan (konten/bantuan.ts). Data saja; dijaga
// apps/client/test/antislop.test.ts.

import { PENGALI_KALDU } from '@remi/engine';

export const TEKS_KALDU = {
  /** Label kotak centang di Atur meja dan lobi. */
  label: 'Mode kaldu',
  /** Satu baris keterangan di bawah kotak centang (layar persiapan, bukan saat main). */
  ket: 'Putaran terakhir pentungannya dikali dua. Deck habis tanpa mentung, kaldu lagi.',
  /** Lobi, bukan host: keadaan mode kaldu sebagai teks. */
  nyala: 'Nyala',
  mati: 'Mati',
  /** Ringkasan meja di tombol "Main bareng warga kedai". */
  ringkas: 'kaldu',
  /** Bar atas dan judul popup joker di putaran kaldu: "Putaran 6 · Kaldu". */
  putaran: 'Kaldu',
  /** Tombol voting di modal hasil putaran. */
  tombol: 'Putaran terakhir',
  batal: 'Batal putaran terakhir',
  /** Modal hasil: putaran berikutnya sudah pasti kaldu. */
  berikutnya: 'Putaran berikutnya kaldu.',
  /** Modal hasil: putaran kaldu habis tanpa mentung. */
  lagi: 'Belum ada yang mentung, kaldu lagi.',
  /** Lencana kecil di panel mentung. */
  lencana: `×${PENGALI_KALDU} KALDU`,
  /** Penanda di riwayat putaran. */
  riwayat: 'kaldu',
} as const;
