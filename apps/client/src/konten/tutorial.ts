// Teks tutorial interaktif (coach marks) untuk permainan latihan pertama.
//
// Hanya mengajarkan aturan asli (README + packages/engine). Tidak boleh membocorkan info rahasia:
// jangan menunjuk kartu tertentu sebagai joker, jangan menyebut angka joker, dan jangan menilai
// kartu mana yang "aman" dibuang. Tiap teks maksimal dua kalimat supaya tidak menutupi meja.

import type { PengaturanMeja } from '@remi/meja';

/**
 * Pengaturan permainan latihan (dipakai main.ts): tiga pemain (kamu + 2 warga kedai mudah), satu
 * putaran, kamu ngocok & jalan duluan. Teks tutorial di bawah mengikuti meja ini. Selalu tanpa
 * batas skor dan tanpa mode kaldu (#42), walau Atur meja offline menyalakannya: tutorialnya
 * menjelaskan skor biasa.
 */
export const PENGATURAN_LATIHAN: Readonly<Partial<PengaturanMeja>> = {
  jumlahPemain: 3,
  duaDeckUntukEmpat: false,
  levelBot: 'mudah',
  tempoBot: 'santai',
  batasPutaran: 1,
  batasSkorAtas: null,
  batasSkorBawah: null,
  modeKaldu: false,
};

export type IdLangkahTutorial =
  | 'sambutan'
  | 'joker'
  | 'tangan'
  | 'giliranAmbil'
  | 'deck'
  | 'buangan'
  | 'mulung'
  | 'turunkan'
  | 'buang'
  | 'giliranLawan'
  | 'kartuJadiLawan'
  | 'mentung'
  | 'susunAkhir'
  | 'skor'
  | 'selesai';

export const URUTAN_TUTORIAL: IdLangkahTutorial[] = [
  'sambutan',
  'joker',
  'tangan',
  'giliranAmbil',
  'deck',
  'buangan',
  'mulung',
  'turunkan',
  'buang',
  'giliranLawan',
  'kartuJadiLawan',
  'mentung',
  'susunAkhir',
  'skor',
  'selesai',
];

export const TEKS_TUTORIAL: Record<IdLangkahTutorial, { judul: string; teks: string; tombol?: string }> = {
  sambutan: {
    judul: 'Monggo, warga baru!',
    teks: 'Remi di Kedai Madya pakai aturan tongkrongan sendiri, banyak bedanya dengan remi umum. Latihan satu putaran dulu, santai saja.',
    tombol: 'Ayo mulai',
  },
  joker: {
    judul: 'Angka joker',
    teks: 'Semua kartu yang angkanya sama dengan kartu yang dibuka ini jadi joker selama putaran. Angkanya cuma diumumkan sekali, jadi ingat baik-baik ya!',
    tombol: 'Siap, sudah kuingat',
  },
  tangan: {
    judul: 'Kartu di tanganmu',
    teks: 'Ketuk kartu untuk memilih, seret untuk mengatur urutan, atau tekan ⇅ untuk mengurutkan. Kartu yang masih di tangan waktu putaran selesai mengurangi skormu.',
  },
  giliranAmbil: {
    judul: 'Giliranmu!',
    teks: 'Tiap giliran urutannya: ambil, turunkan kalau bisa, lalu buang. Mulai dengan ambil satu kartu dari deck, atau mulung dari buangan.',
  },
  deck: {
    judul: 'Ambil dari deck',
    teks: 'Ketuk deck untuk ambil satu kartu teratas. Habis ambil dari deck, kamu nggak bisa nutup di giliran itu.',
  },
  buangan: {
    judul: 'Tumpukan buangan',
    teks: 'Yang kelihatan cuma beberapa kartu teratas, sebanyak jumlah pemain dikurangi satu. Kartu di bawahnya harus kamu ingat sendiri.',
  },
  mulung: {
    judul: 'Mulung',
    teks: 'Ketuk kartu di buangan untuk mungut kartu itu dan semua di atasnya. Kartu paling bawah yang dipungut wajib langsung dijadikan, dengan modal dari tangan minimal sama banyak dengan pungutannya.',
  },
  turunkan: {
    judul: 'Turunkan kartu jadi',
    teks: 'Pilih minimal 3 kartu yang membentuk seri satu bunga atau kembar As, lalu tekan Turunkan. Kartu jadi menambah skor, tapi nggak bisa ditempeli kartu lagi.',
  },
  buang: {
    judul: 'Buang satu kartu',
    teks: 'Akhiri giliran dengan membuang satu kartu: pilih lalu tekan Buang, atau seret ke tumpukan buangan. As baru boleh dibuang kalau kamu sudah punya kartu jadi.',
  },
  giliranLawan: {
    judul: 'Giliran lawan',
    teks: 'Sekarang lawan yang jalan. Perhatikan apa yang mereka ambil dan buang, karena nanti nggak bisa dilihat lagi.',
  },
  kartuJadiLawan: {
    judul: 'Kartu jadi lawan',
    teks: 'Kartu jadi yang sudah diturunkan terlihat semua orang dan menambah skor pemiliknya. Kalau kartu buanganmu dipungut lalu dipakai, kartunya ikut nangkring di situ.',
  },
  mentung: {
    judul: 'Mentung!',
    teks: 'Kalau giliranmu diawali mulung dan kartumu tinggal satu, buang kartu itu untuk mentung. Pemilik kartu pungutan yang kamu pakai di kartu jadi kena kepentung.',
  },
  susunAkhir: {
    judul: 'Susun akhir',
    teks: 'Setelah mentung atau deck habis, semua boleh menurunkan kartu jadi dari tangan tanpa mulung. Kalau sudah, tekan Selesai.',
  },
  skor: {
    judul: 'Hitung skor',
    teks: 'Skor putaran = nilai kartu jadi dikurangi nilai kartu di tangan; yang mentung dapat bonus pentungan, yang kepentung kena potongan sebesar itu. Skornya dijumlah terus tiap putaran.',
  },
  selesai: {
    judul: 'Mantap, Bos!',
    teks: 'Kamu sudah siap main pakai aturan tongkrongan. Aturan lengkap bisa dibuka lagi di Bantuan kapan saja.',
    tombol: 'Ayo main',
  },
};
