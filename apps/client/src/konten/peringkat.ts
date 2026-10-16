// Teks layar Riwayat untuk leaderboard (keputusan pemilik #45). Aturan hitungnya sendiri ada di
// packages/meja/src/peringkat.ts; teks di sini wajib sesuai dengan aturan itu. Dijaga
// apps/client/test/antislop.test.ts dan riwayat.test.ts.

import { MIN_MAIN, type PeriodePeringkat, type UrutanPeringkat } from '@remi/meja';

/** Label pilihan "Urutkan dari". */
export const LABEL_URUTAN: Record<UrutanPeringkat, string> = {
  rata: 'Rata-rata skor',
  terbaik: 'Skor terbaik',
  persen: 'Persen juara',
  juara: 'Jumlah juara',
  main: 'Paling sering main',
  mentung: 'Paling sering mentung',
  posisi: 'Poin posisi',
};

/** Penjelasan singkat di bawah pilihan urutan. */
export const JELAS_URUTAN: Record<UrutanPeringkat, string> = {
  rata: 'Jumlah skor akhir dibagi berapa kali main. Main dua kali dengan skor 200 dan 100, rata-ratanya 150.',
  terbaik: 'Skor akhir paling tinggi dalam satu permainan.',
  persen: 'Berapa persen permainan yang berakhir juara.',
  juara: 'Berapa kali juara. Kalau sama, yang total skornya lebih tinggi di atas.',
  main: 'Berapa kali main sampai permainan selesai.',
  mentung: 'Berapa kali mentung.',
  posisi: 'Juara dapat 100, juru kunci 0, posisi di tengahnya dibagi rata, lalu dirata-rata. Jadi meja 2 orang dan meja 6 orang sebanding.',
};

/** Tambahan penjelasan untuk urutan yang butuh minimal main. */
export const SYARAT_MIN_MAIN = `Minimal ${MIN_MAIN} kali main.`;

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
  semua: 'Sepanjang masa',
  bulan: 'Bulan ini',
};

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** '2026-10' → 'Oktober 2026'. Bentuk lain dikembalikan apa adanya. */
export function labelBulan(bulan: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(bulan);
  const nama = m ? NAMA_BULAN[Number(m[2]) - 1] : undefined;
  return m && nama ? `${nama} ${Number(m[1])}` : bulan;
}

/** Isi lipatan "Cara hitungnya" di tab Peringkat. */
export const CARA_HITUNG: readonly string[] = [
  'Cuma permainan online yang dimainkan minimal 2 orang. Main sendirian lawan warga kedai nggak masuk peringkat, tapi tetap tercatat di tab Permainan.',
  'Warga kedai nggak masuk daftar, tapi tetap dihitung sebagai lawan. Kalau skornya di atasmu, posisimu ikut turun.',
  'Skor tertinggi sama? Semua yang sama-sama tertinggi dihitung juara.',
  'Yang menekan Keluar waktu permainan masih jalan dihitung juru kunci, skornya disamakan dengan skor terendah di meja itu. Sinyal putus atau aplikasi ketutup nggak dihitung keluar.',
  'Nama digabung tanpa beda huruf besar/kecil, jadi "Budi" dan "budi" dihitung satu orang. Yang tampil ejaan terakhir.',
  `Rata-rata skor, persen juara, dan poin posisi baru keluar sesudah ${MIN_MAIN} kali main. Sebelum itu namanya ada di "Belum cukup main".`,
];

export const JUDUL_CARA_HITUNG = 'Cara hitungnya';
export const JUDUL_BELUM_CUKUP = `Belum cukup main (kurang dari ${MIN_MAIN} kali)`;
export const CATATAN_DECK =
  'Permainan 4 orang dari sebelum pembaruan ini nggak tercatat pakai 1 atau 2 deck, jadi nggak ikut kalau deck dipilih.';
export const CATATAN_SERVER_LAMA =
  'Server belum diperbarui, jadi urutan dan saringan belum bisa dipilih. Untuk sementara urut dari jumlah juara, lalu total skor.';
export const KOSONG_PERINGKAT = 'Belum ada permainan online bareng teman yang selesai.';
export const KOSONG_SARINGAN = 'Belum ada permainan yang cocok dengan pilihan ini.';
export const LENCANA_KELUAR = 'keluar';
export const LENCANA_TIDAK_DIHITUNG = 'nggak masuk peringkat';

/** Catatan di tab Statistik (HP ini). */
export const CATATAN_STATISTIK =
  'Cuma pemain beneran, digabung tanpa beda huruf besar/kecil. Warga kedai nggak masuk daftar, tapi tetap dihitung sebagai lawan. Main sendirian lawan warga kedai juga ikut di sini.';
