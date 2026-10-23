// Teks layar Kompetisi dan meja kompetisi (keputusan pemilik #51). Data saja; aturan hitungnya di
// @remi/meja (kompetisi.ts). Dijaga apps/client/test/antislop.test.ts.

import { MIN_MAIN_KOMPETISI, MIN_PESERTA, type MasaKompetisi, type StatusKompetisi } from '@remi/meja';

export const TEKS_KOMPETISI = {
  judul: 'Kompetisi',
  /** Tombol di panel Main online beranda. */
  tombolBeranda: 'Kompetisi',
  ajak: `Ajukan kompetisi, lalu ajak teman menekan Ikut serta. Begitu ${MIN_PESERTA} orang ikut, kompetisinya jalan.`,
  tombolAjukan: 'Ajukan kompetisi',
  judulAjukan: 'Ajukan kompetisi',
  labelNama: 'Nama kompetisi',
  contohNama: 'misal: Remi Jumat Kedai',
  labelMasa: 'Lama kompetisi',
  ketAturan: 'Aturan meja ini berlaku di semua meja kompetisi dan tidak bisa diubah sesudah diajukan.',
  kirimAjukan: 'Ajukan',
  batal: 'Nggak jadi',
  kosong: 'Belum ada kompetisi. Ajukan yang pertama, Bos.',
  bagianPengajuan: 'Menunggu peserta',
  bagianBerjalan: 'Sedang jalan',
  bagianSelesai: 'Sudah selesai',
  lencanaIkut: 'kamu ikut',
  ikutSerta: 'Ikut serta',
  buatMeja: 'Buat meja kompetisi',
  ketMeja: 'Teman peserta gabung pakai kode meja seperti biasa. Meja kompetisi tanpa warga kedai.',
  /** Diikuti "N dari M setuju". */
  sudahi: 'Sudahi lebih awal',
  batalSudahi: 'Batal sudahi',
  ketSudahi: 'Kompetisi selesai sekarang kalau lebih dari separuh peserta setuju.',
  judulKlasemen: 'Klasemen',
  judulBelumCukup: `Belum ${MIN_MAIN_KOMPETISI}× main`,
  klasemenKosong: 'Belum ada permainan kompetisi.',
  caraHitung: `Tiap permainan di meja kompetisi, kamu dapat 1 poin untuk setiap peserta yang kalah skor darimu. Meja 4 orang: juara 3 poin, juru kunci 0. Keluar di tengah permainan = 0 poin. Masuk klasemen sesudah ${MIN_MAIN_KOMPETISI}× main. Poin sama: rata-rata poin per main, lalu rata-rata skor akhir.`,
  juara: 'Juara',
  gagalMuat: 'Kompetisi belum bisa dibuka. Cek sinyal lalu coba lagi.',
  cobaLagi: 'Coba lagi',
  kembali: '← Kembali',
  kembaliBeranda: '← Kembali ke beranda',
  /** Lobi meja kompetisi. */
  lencanaMeja: 'Meja kompetisi',
  aturanDikunci: 'Aturan meja ikut kompetisinya.',
  kursiKosong: 'Masih ada kursi kosong: tunggu peserta lain masuk, atau kurangi jumlah pemain.',
  /** Ditambahkan ke konfirmasi keluar di tengah permainan. */
  keluarMeja: 'Di kompetisi kamu dapat 0 poin untuk permainan ini.',
  toastIkut: 'Kamu sudah ikut. Tiketnya tersimpan di HP ini.',
  toastAjukan: 'Kompetisi diajukan. Ajak teman ikut serta, Bos.',
  catatanHp: 'Tiket peserta tersimpan di HP ini. Main kompetisi dari HP yang sama, ya.',
} as const;

export const LABEL_MASA: Record<MasaKompetisi, string> = {
  malam: '1 malam (sampai jam 6 pagi)',
  minggu: '1 minggu',
  bulan: '1 bulan',
};

export const LABEL_STATUS: Record<StatusKompetisi, string> = {
  pengajuan: 'menunggu peserta',
  batal: 'batal',
  berjalan: 'sedang jalan',
  selesai: 'selesai',
};
