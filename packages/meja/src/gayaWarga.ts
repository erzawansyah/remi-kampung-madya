// Gaya main warga kedai per persona (keputusan pemilik #47). Gaya mengikuti NAMA, satu arah: nama
// dipilih tanpa melihat level atau gaya (urutan acak NAMA_LAWAN_BAWAAN), lalu gaya dibaca dari nama
// itu. Level tetap menentukan seberapa kuat; gaya hanya kebiasaan main (lihat bot/gaya.ts di engine).
//
// Gaya TIDAK pernah dikirim ke pemain: tidak masuk InfoMeja, protokol, view, UI, Bantuan, maupun teks
// pemain. (Tabel ini tetap ikut bundel offline, jadi "tersembunyi" artinya tidak ditampilkan di UI.)
//
// Nama baru di NAMA_LAWAN_BAWAAN wajib diberi gaya di sini juga; test/gaya.test.ts gagal kalau lupa.

import type { GayaBot } from '@remi/engine';
import type { Kursi } from './meja.js';
import { kunciNama, rapikanNama } from './validasi.js';

/** Gaya tiap warga kedai bawaan (ejaan persis NAMA_LAWAN_BAWAAN). */
export const GAYA_WARGA: Readonly<Record<string, GayaBot>> = {
  // Rinciannya di DEFINISI_GAYA (engine, bot/gaya.ts); di sini cuma intinya.
  // Kilat: mulung lebih rakus.
  'Kipas Dua': 'kilat',
  'Dik Toska': 'kilat',
  'Bu Sendok': 'kilat',
  // Sabar Londo: tidak membuang Londo sebelum ada yang membuang Londo duluan.
  'Cak Kopag': 'sabarLondo',
  'Ning Sore': 'sabarLondo',
  'Koki-Kun': 'sabarLondo',
  'Pak Tani': 'sabarLondo',
  // Ngurutin: kalau merasa kalah, membuang kartu yang menyambung buangan pemain sebelumnya.
  'Mas Sampul': 'ngurutin',
  'Si Rak': 'ngurutin',
  'Ning Kukis': 'ngurutin',
  // Pemburu pentungan: menyimpan calon pentungan besar.
  'Pak Seng': 'pemburu',
  'Om Garpu': 'pemburu',
  Penampil: 'pemburu',
  Juragan: 'pemburu',
  // Penahan: menahan kartu yang kemungkinan dibutuhkan pemain berikutnya.
  'Mbak Teras': 'penahan',
  'Cak Owner': 'penahan',
  'Bang IT': 'penahan',
  'Mbak Mata': 'penahan',
  // Berubah-ubah: tiap putaran salah satu gaya di atas.
  Jurik: 'berubah',
  'Bos Bocil': 'berubah',
  'Om Napi': 'berubah',
  Bajigur: 'berubah',
};

/** GAYA_WARGA dengan kunci kunciNama (tanpa beda huruf besar/kecil dan spasi tepi). */
const GAYA_PER_KUNCI: ReadonlyMap<string, GayaBot> = new Map(
  Object.entries(GAYA_WARGA).map(([nama, gaya]) => [kunciNama(rapikanNama(nama)), gaya]),
);

/** Gaya untuk nama warga kedai. Nama di luar daftar ("Warga 1", nama orang, data rusak) = 'standar'. */
export function gayaUntukNama(nama: unknown): GayaBot {
  if (typeof nama !== 'string') return 'standar';
  return GAYA_PER_KUNCI.get(kunciNama(rapikanNama(nama))) ?? 'standar';
}

/**
 * Gaya untuk kursi yang dijalankan warga kedai. Hanya kursi warga kedai yang memakai gaya personanya.
 * Kursi manusia (giliran yang diambil alih karena terputus atau kehabisan waktu) dan kursi yang
 * ditinggal pemainnya di tengah permainan (`keluar`, namanya nama orang itu) memakai 'standar'.
 */
export function gayaKursi(k: Kursi): GayaBot {
  return k.jenis === 'bot' && !k.keluar ? gayaUntukNama(k.nama) : 'standar';
}
