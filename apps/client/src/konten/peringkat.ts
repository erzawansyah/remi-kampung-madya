// Teks layar Riwayat untuk leaderboard (keputusan pemilik #45). Aturan hitungnya sendiri ada di
// packages/meja/src/peringkat.ts; teks di sini wajib sesuai dengan aturan itu. Dijaga
// apps/client/test/antislop.test.ts dan riwayat.test.ts.

import { MIN_MAIN, type PeriodePeringkat, type UrutanPeringkat } from '@remi/meja';

/** Label pilihan "Urutkan". */
export const LABEL_URUTAN: Record<UrutanPeringkat, string> = {
  rata: 'Rata-rata skor',
  terbaik: 'Skor terbaik',
  persen: 'Persen juara',
  juara: 'Jumlah juara',
  main: 'Paling sering main',
  mentung: 'Paling sering mentung',
  posisi: 'Poin posisi',
};

/** Arti tiap urutan, satu kalimat pendek (di lipatan "Cara hitungnya", bukan di layar utama). */
export const JELAS_URUTAN: Record<UrutanPeringkat, string> = {
  rata: 'Rata-rata skor: skor akhir dirata-rata per permainan (200 dan 100 jadi 150).',
  terbaik: 'Skor terbaik: skor akhir tertinggi dalam satu permainan.',
  persen: 'Persen juara: berapa persen permainan yang dimenangkan.',
  juara: 'Jumlah juara: kalau sama, total skor yang menentukan.',
  main: 'Paling sering main: jumlah permainan sampai selesai.',
  mentung: 'Paling sering mentung: jumlah mentung.',
  posisi: 'Poin posisi: juara 100, juru kunci 0, lalu dirata-rata.',
};

/** Keterangan kecil di bawah angka besar di kanan tiap baris. */
export const KETERANGAN_ANGKA: Record<UrutanPeringkat, string> = {
  rata: 'rata-rata',
  terbaik: 'skor terbaik',
  persen: 'juara',
  juara: 'juara',
  main: 'main',
  mentung: 'mentung',
  posisi: 'poin posisi',
};

export const LABEL_PERIODE: Record<PeriodePeringkat, string> = {
  semua: 'Semua',
  bulan: 'Bulan ini',
};

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** '2026-10' → 'Oktober 2026'. Bentuk lain dikembalikan apa adanya. */
export function labelBulan(bulan: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(bulan);
  const nama = m ? NAMA_BULAN[Number(m[2]) - 1] : undefined;
  return m && nama ? `${nama} ${Number(m[1])}` : bulan;
}

/** Isi lipatan "Cara hitungnya" di tab Peringkat (sesudah arti urutan yang sedang dipilih). */
export const CARA_HITUNG: readonly string[] = [
  'Cuma permainan online minimal 2 orang. Warga kedai nggak masuk daftar, tapi tetap dihitung sebagai lawan.',
  `Rata-rata, persen juara, dan poin posisi muncul sesudah ${MIN_MAIN} kali main.`,
  'Keluar di tengah permainan dihitung juru kunci.',
  'Nama tanpa beda huruf besar/kecil: "Budi" sama dengan "budi".',
];

export const JUDUL_CARA_HITUNG = 'Cara hitungnya';
export const JUDUL_BELUM_CUKUP = `Belum ${MIN_MAIN} kali main`;
export const CATATAN_DECK = 'Permainan 4 orang yang lama nggak ikut (deck-nya nggak tercatat).';
export const CATATAN_SERVER_LAMA = 'Server belum diperbarui, jadi urutan dan saringan belum bisa dipilih.';
export const KOSONG_PERINGKAT = 'Belum ada permainan online bareng teman yang selesai.';
export const KOSONG_SARINGAN = 'Belum ada permainan yang cocok.';
export const KOSONG_PERMAINAN = 'Belum ada permainan online yang selesai.';
export const LENCANA_KELUAR = 'keluar';
export const LENCANA_TIDAK_DIHITUNG = 'nggak masuk peringkat';

/** Tab HP ini. */
export const KOSONG_LOKAL = 'Belum ada permainan yang selesai di HP ini. Kalau mau main langsung, ajak teman ke Kedai Madya.';
export const KET_LOKAL = '30 permainan terakhir di HP ini.';

/** Tab Statistik (HP ini). */
export const KOSONG_STATISTIK = 'Belum ada permainan yang selesai di HP ini.';
export const CATATAN_STATISTIK = 'Warga kedai nggak masuk daftar, tapi tetap dihitung sebagai lawan.';
