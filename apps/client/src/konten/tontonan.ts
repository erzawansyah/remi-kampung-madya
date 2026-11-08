// Teks fitur nonton (keputusan pemilik #60, aturan minta lihat #62). Satu sumber untuk layar penonton,
// mode lihat kartu, dan permintaan yang masuk ke pemain. Tidak pernah menyebut kartu tangan siapa pun.

import { JEDA_SESUDAH_LIHAT_MS } from '@remi/meja';

/** Lama jeda sesudah melihat kartu, dalam menit (#62). */
const MENIT_JEDA = Math.round(JEDA_SESUDAH_LIHAT_MS / 60_000);

/** Hitung mundur "29:59" / "0:45" (dibulatkan ke atas, paling kecil 0:00). */
export function jamMundur(ms: number): string {
  const detik = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(detik / 60)}:${String(detik % 60).padStart(2, '0')}`;
}

export const TEKS_TONTONAN = {
  // Kode meja tidak pernah ditampilkan ke penonton (yang dipegangnya kode tonton): cukup nama host.
  judul: (namaHost: string) => (namaHost ? `Nonton meja ${namaHost}` : 'Nonton meja'),
  /** Lencana bar atas meja selama penonton melihat kartu pemain (tanpa kode meja). */
  labelAtas: 'Nonton',
  /** Keterangan menu ☰ selama penonton melihat kartu pemain (pengganti kode meja). */
  menuPenonton: 'Kamu lagi nonton meja ini, jadi nggak bisa ikut main dari sini.',
  jumlahPenonton: (n: number) => `${n} penonton`,
  pengantar: 'Kamu cuma lihat kartu buangan. Mau lihat kartu seorang pemain? Minta izin dulu ke orangnya.',
  judulPemain: 'Pemain',
  judulBuangan: 'Kartu buangan',
  buanganKosong: 'Belum ada kartu yang dibuang.',
  minta: 'Minta lihat kartu',
  /** Tombol kursi yang sedang diminta, dengan hitung mundur batas jawab. */
  menunggu: (ms: number) => (ms > 0 ? `Nunggu jawaban… ${jamMundur(ms)}` : 'Nunggu jawaban…'),
  /** Tombol kursi lain selama ada permintaan yang menunggu (#62: satu per satu). */
  tungguJawaban: 'Tunggu jawaban dulu',
  /** Tombol kursi lain selama jeda sesudah melihat. */
  jedaTombol: (ms: number) => `Tunggu ${jamMundur(ms)}`,
  ditolak: 'Nggak mau dilihat',
  tidakDijawab: 'Nggak dijawab',
  dilihat: 'Lagi kamu lihat',
  tidakBisa: 'Nggak bisa diminta sekarang',
  /** Semua tombol selama namamu dipakai minta/lihat kartu dari tempat lain (tanpa rincian). */
  tertahanTombol: 'Belum bisa',
  tertahan: 'Namamu lagi dipakai minta atau lihat kartu di tempat lain, atau baru saja. Tombolnya hidup lagi sesudah itu.',
  /** Baris hitung mundur di bawah daftar pemain. */
  hitungMenunggu: (nama: string, ms: number) => `Nunggu jawaban ${nama}. Sisa waktunya ${jamMundur(ms)}.`,
  hitungJeda: (ms: number) => `Habis lihat kartu, kamu bisa minta lagi dalam ${jamMundur(ms)}.`,
  keteranganBlokir: 'Yang menolak atau nggak menjawab nggak bisa diminta lagi sampai permainannya selesai.',
  berhenti: 'Berhenti nonton',
  selesaiPutaran: 'Putarannya sudah selesai. Tunggu putaran berikutnya.',
  selesaiPermainan: 'Permainannya sudah selesai.',
  // Mode lihat kartu (KontrolMeja penonton)
  melihat: (nama: string) => `Kamu lagi lihat kartu ${nama}.`,
  berhentiLihat: 'Berhenti lihat',
  // Kabar ke penonton (toast + pembaca layar)
  diizinkan: (nama: string) => `${nama} mengizinkan kamu lihat kartunya.`,
  berhentiDibagi: (nama: string) => `${nama} berhenti membagi kartunya. Kamu bisa minta lihat lagi ${MENIT_JEDA} menit lagi.`,
  berhentiSendiri: `Oke, berhenti lihat. Kamu bisa minta lihat lagi ${MENIT_JEDA} menit lagi.`,
  kabarDitolak: (nama: string) => `${nama} belum mau kartunya dilihat. Coba minta ke pemain lain.`,
  kabarTidakDijawab: (nama: string) => `${nama} nggak jawab. Coba minta ke pemain lain.`,
  izinLepasPutus: `Sambunganmu sempat putus, jadi izin lihat kartunya lepas. Kamu bisa minta lihat lagi ${MENIT_JEDA} menit lagi.`,
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
