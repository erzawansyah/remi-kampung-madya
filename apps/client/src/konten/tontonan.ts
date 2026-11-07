// Teks fitur nonton (keputusan pemilik #60). Satu sumber untuk layar penonton, mode lihat kartu, dan
// permintaan yang masuk ke pemain. Tidak pernah menyebut kartu tangan siapa pun.

import { teksSisaJeda } from '@remi/meja';

export const TEKS_TONTONAN = {
  judul: (kode: string) => `Nonton meja ${kode}`,
  jumlahPenonton: (n: number) => `${n} penonton`,
  pengantar: 'Kamu cuma lihat kartu buangan. Mau lihat kartu seorang pemain? Minta izin dulu ke orangnya.',
  judulPemain: 'Pemain',
  judulBuangan: 'Kartu buangan',
  buanganKosong: 'Belum ada kartu yang dibuang.',
  minta: 'Minta lihat kartu',
  menunggu: 'Nunggu jawaban…',
  jeda: (ms: number) => `Bisa minta lagi ${teksSisaJeda(ms)} lagi`,
  dilihat: 'Lagi kamu lihat',
  tidakBisa: 'Nggak bisa diminta sekarang',
  berhenti: 'Berhenti nonton',
  selesaiPutaran: 'Putarannya sudah selesai. Tunggu putaran berikutnya.',
  selesaiPermainan: 'Permainannya sudah selesai.',
  // Mode lihat kartu (KontrolMeja penonton)
  melihat: (nama: string) => `Kamu lagi lihat kartu ${nama}.`,
  berhentiLihat: 'Berhenti lihat',
  // Pemain: permintaan yang masuk
  permintaan: (nama: string) => `${nama} pengin lihat kartumu.`,
  tolak: 'Tolak',
  izinkan: 'Izinkan',
  sedangDilihat: (nama: string[]) => `${nama.join(', ')} lagi lihat kartumu.`,
  hentikan: 'Hentikan',
  labelPenonton: (n: number) => `${n} penonton`,
  judulDialogPenonton: 'Penonton',
  dialogPenontonKosong: 'Nggak ada yang lagi lihat kartumu.',
  dialogPenontonJumlah: (n: number) => `Ada ${n} penonton di meja ini. Mereka cuma lihat kartu buangan, kecuali yang kamu izinkan.`,
} as const;
