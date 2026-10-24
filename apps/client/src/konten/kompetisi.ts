// Teks layar Kompetisi dan meja kompetisi (keputusan pemilik #51, versi 2 24 Okt 2026). Data saja
// (plus beberapa fungsi penyusun kalimat); aturan hitungnya di @remi/meja (kompetisi.ts). Dijaga
// apps/client/test/antislop.test.ts.

import {
  MIN_MAIN_KOMPETISI,
  MIN_PESERTA,
  NILAI_MAKS,
  teksNilai,
  type HasilKompetisiKursi,
  type MasaKompetisi,
  type StatusKompetisi,
} from '@remi/meja';

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
  labelJumlah: 'Pemain per meja',
  labelPutaran: 'Batas putaran',
  labelDuaDeck: 'Meja 4 pemain pakai 2 deck',
  labelDetik: 'Waktu per giliran',
  kirimAjukan: 'Ajukan',
  batal: 'Nggak jadi',
  kosong: 'Belum ada kompetisi. Ajukan yang pertama, Bos.',
  bagianPengajuan: 'Menunggu peserta',
  bagianBerjalan: 'Sedang jalan',
  bagianSelesai: 'Sudah selesai',
  lencanaIkut: 'kamu ikut',
  ikutSerta: 'Ikut serta',
  /** Daftar meja yang menunggu peserta (detail kompetisi yang sedang jalan). */
  judulMeja: 'Meja yang menunggu',
  mejaKosong: 'Belum ada meja yang menunggu. Buka meja baru, nanti peserta lain bisa duduk di situ.',
  duduk: 'Duduk',
  bukaMeja: 'Buka meja baru',
  ketMeja: 'Meja mulai sendiri begitu semua kursinya terisi peserta. Meja kompetisi tanpa warga kedai dan cuma sekali main.',
  /** Meja yang kursinya sudah penuh dan sedang hitung mundur mulai sendiri. */
  mejaPenuh: 'penuh, sebentar lagi mulai',
  /** Diikuti "N dari M setuju". */
  sudahi: 'Sudahi lebih awal',
  batalSudahi: 'Batal sudahi',
  ketSudahi: 'Kompetisi selesai sekarang kalau lebih dari separuh peserta setuju.',
  judulKlasemen: 'Klasemen',
  judulBelumCukup: `Belum ${MIN_MAIN_KOMPETISI}× main`,
  klasemenKosong: 'Belum ada permainan kompetisi.',
  caraHitung: `Tiap permainan di meja kompetisi dapat nilai 0 sampai ${NILAI_MAKS}: banyaknya peserta lain di meja itu yang kalah skor darimu, dibagi (jumlah kursi − 1), dikali ${NILAI_MAKS}. Meja 4 orang: juara 10; kedua 6,7; ketiga 3,3; juru kunci 0. Skor sama tidak saling mengalahkan. Keluar di tengah permainan = 0, dan yang keluar tidak dihitung sebagai lawan: nilai yang lain dihitung dari peserta yang bertahan sampai akhir saja (meja 4 orang dengan 1 yang keluar: 10; 5; 0). Kalau cuma satu yang bertahan, permainan itu tidak dihitung untuknya, tapi yang keluar tetap dapat 0. Klasemen diurutkan dari rata-rata nilai per permainan; masuk klasemen sesudah ${MIN_MAIN_KOMPETISI}× main. Rata-rata sama: yang lebih sering main di atas, lalu rata-rata skor akhir.`,
  juara: 'Juara',
  /** Status 'selesai' karena masanya habis, tapi masih ada meja yang main: juara belum diumumkan. */
  lencanaMenunggu: 'waktu habis',
  /** Sama, tapi kompetisinya disudahi lewat voting (masanya belum habis). */
  lencanaMenungguDisudahi: 'disudahi',
  ketJuaraNanti: 'Juaranya diumumkan sesudah meja terakhir selesai.',
  gagalMuat: 'Kompetisi belum bisa dibuka. Cek sinyal lalu coba lagi.',
  cobaLagi: 'Coba lagi',
  kembali: '← Kembali',
  kembaliBeranda: '← Kembali ke beranda',
  /** Lobi meja kompetisi. */
  lencanaMeja: 'Meja kompetisi',
  aturanDikunci: 'Aturan meja ikut kompetisinya.',
  judulAturan: 'Aturan meja',
  /** Lobi: kursi sudah penuh, meja mulai sendiri (diikuti hitung mundur). */
  lobiPenuh: 'Kursi penuh. Permainan mulai sendiri',
  /** Lobi: kursi penuh tapi ada yang terputus (atau hitung mundurnya belum jalan). */
  menungguTersambung: 'Menunggu semua peserta tersambung…',
  ketLobi: 'Meja ini mulai sendiri begitu semua kursinya terisi peserta yang tersambung.',
  /** Konfirmasi keluar dari lobi meja kompetisi. */
  keluarLobi: 'Kursimu di lobi dilepas. Mau balik? Duduk lagi dari daftar meja di layar Kompetisi selama masih ada kursi kosong.',
  /** Ditambahkan ke konfirmasi keluar di tengah permainan. */
  keluarMeja: 'Di kompetisi nilaimu 0 untuk permainan ini.',
  /** Konfirmasi keluar sesudah klasemen akhir meja kompetisi. */
  keluarSelesai: 'Permainannya sudah selesai. Meja kompetisi cuma sekali main.',
  /** Klasemen akhir meja kompetisi: ganti tombol Main lagi. */
  kembaliKompetisi: 'Kembali ke kompetisi',
  /** Judul bagian hasil kompetisi di klasemen akhir (diikuti nama kompetisinya). */
  judulHasil: 'Nilai kompetisi',
  /** Klasemen akhir meja kompetisi yang tinggal satu (atau nol) peserta bertahan sampai akhir. */
  tidakDihitungKeluar: 'Hampir semua pemain keluar, jadi permainan ini tidak dihitung untukmu. Yang keluar tetap dapat nilai 0.',
  /** Hasil putaran meja kompetisi: diikuti hitung mundur detik. */
  lanjutOtomatis: 'Kalau host belum mulai, putaran berikutnya mulai sendiri dalam',
  /** Waktu per giliran di formulir pengajuan: wajib ada di kompetisi. */
  ketDetik: 'Giliran yang kehabisan waktu dijalankan warga kedai, jadi tidak ada meja yang tertahan.',
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

/** "Menunggu N peserta lagi…" di lobi meja kompetisi. */
export const teksMenungguPeserta = (n: number): string => (n === 1 ? 'Menunggu 1 peserta lagi…' : `Menunggu ${n} peserta lagi…`);

/**
 * Keterangan kompetisi yang waktunya sudah habis (atau disudahi lewat voting) tapi masih ada meja
 * yang main: juaranya belum diumumkan.
 */
export const teksMenungguMeja = (n: number, disudahi: boolean): string =>
  `${disudahi ? 'Disudahi' : 'Waktu habis'} · menunggu ${n} meja terakhir selesai`;

/** Peringkat di klasemen sesudah satu permainan: naik, turun, tetap, baru masuk, atau belum masuk. */
export function teksPeringkatKompetisi(h: Pick<HasilKompetisiKursi, 'main' | 'peringkatSebelum' | 'peringkatSesudah'>, minMain: number, jumlah: number): string {
  const sesudah = h.peringkatSesudah;
  if (sesudah === null) return `belum masuk klasemen (${h.main} dari ${minMain} main)`;
  const dari = `(dari ${jumlah})`;
  const sebelum = h.peringkatSebelum;
  if (sebelum === null) return `masuk klasemen di peringkat ${sesudah} ${dari}`;
  if (sesudah < sebelum) return `naik ke peringkat ${sesudah} ${dari}`;
  if (sesudah > sebelum) return `turun ke peringkat ${sesudah} ${dari}`;
  return `tetap di peringkat ${sesudah} ${dari}`;
}

/**
 * Satu baris hasil kompetisi satu peserta di klasemen akhir meja kompetisi, misalnya
 * "+6,7 · rata-rata 5,8 · naik ke peringkat 2 (dari 4)". Angka dari server (pesan kompetisiHasil),
 * hanya dirangkai di sini.
 */
export function teksHasilKompetisi(h: HasilKompetisiKursi, minMain: number, jumlah: number): string {
  const nilai = h.keluar ? `${teksNilai(0)} (keluar)` : `+${teksNilai(h.nilai)}`;
  return `${nilai} · rata-rata ${teksNilai(h.rataNilai)} · ${teksPeringkatKompetisi(h, minMain, jumlah)}`;
}

/** Piala juara kompetisi di samping nama: "🏆" sekali juara, "🏆2" dua kali, dst. Kosong kalau 0. */
export const teksPiala = (n: number | undefined): string => (n && n > 0 ? (n === 1 ? '🏆' : `🏆${n}`) : '');
/** Untuk pembaca layar. */
export const ariaPiala = (n: number): string => (n === 1 ? 'juara kompetisi sekali' : `juara kompetisi ${n} kali`);
