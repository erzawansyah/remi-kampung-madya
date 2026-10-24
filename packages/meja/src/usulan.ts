// Usul fitur dari dalam game (keputusan pemilik 24 Okt 2026): batas isian dan perapian teks. Satu
// sumber untuk server (POST /api/usulan, apps/server/src/usulan.ts) dan dialog Usul fitur di HP
// (apps/client/src/ui/usulan.ts), supaya yang ditolak di HP sama persis dengan yang ditolak server.
// Murni: tanpa DOM, tanpa Node API.

import { jumlahHuruf, rapikanNama, rapikanTeks } from './validasi.js';

/** Pilihan jenis usulan; namanya sama persis dengan opsi select "Jenis" di database Notion pemilik. */
export const DAFTAR_JENIS_USULAN = ['Fitur', 'Perbaikan bug', 'Tampilan', 'Aturan main', 'Lainnya'] as const;
export type JenisUsulan = (typeof DAFTAR_JENIS_USULAN)[number];

export const isJenisUsulan = (x: unknown): x is JenisUsulan => (DAFTAR_JENIS_USULAN as readonly unknown[]).includes(x);

/** Panjang judul dan isi, dalam huruf yang tampil (sesudah dirapikan). */
export const MIN_JUDUL_USULAN = 3;
export const MAKS_JUDUL_USULAN = 80;
export const MIN_ISI_USULAN = 10;
export const MAKS_ISI_USULAN = 1000;

/** Teks mentah yang jauh lebih panjang dari batasnya ditolak tanpa dirapikan (jaga-jaga isi raksasa). */
const KALI_MENTAH = 4;

/** Pesan penolakan; ditampilkan apa adanya di dialog (dari HP sendiri maupun dari server). */
export const PESAN_USULAN = {
  namaKosong: 'Isi namamu dulu di beranda, Bos.',
  judulPendek: `Judulnya minimal ${MIN_JUDUL_USULAN} huruf, Bos.`,
  judulPanjang: `Judulnya kepanjangan, maksimal ${MAKS_JUDUL_USULAN} huruf.`,
  isiPendek: `Ceritakan sedikit lagi, minimal ${MIN_ISI_USULAN} huruf.`,
  isiPanjang: `Isinya kepanjangan, maksimal ${MAKS_ISI_USULAN} huruf.`,
  jenisAsing: 'Jenis usulannya nggak dikenal.',
} as const;

export interface Usulan {
  /** Nama pemain (dirapikan seperti nama di meja). */
  nama: string;
  judul: string;
  /** Boleh beberapa baris ("\n"). */
  isi: string;
  /** Kosong = pemain tidak memilih. */
  jenis: JenisUsulan | null;
}

export type IsianUsulan = 'nama' | 'judul' | 'isi' | 'jenis';

export type HasilPeriksaUsulan = { ok: true; usulan: Usulan } | { ok: false; isian: IsianUsulan; pesan: string };

/** Teks bebas: null kalau bukan string, kebesaran mentahnya, atau isinya tidak ada yang terlihat. */
function teks(x: unknown, maks: number, barisBaru: boolean): string | null {
  if (typeof x !== 'string' || x.length > maks * KALI_MENTAH) return null;
  return rapikanTeks(x, { barisBaru });
}

/**
 * Periksa dan rapikan usulan dari data tak dipercaya ({nama, judul, isi, jenis?}). Penolakan pertama
 * yang ditemukan (urut: nama, jenis, judul, isi) dikembalikan bersama isian yang salah.
 */
export function periksaUsulan(x: unknown): HasilPeriksaUsulan {
  const d = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const tolak = (isian: IsianUsulan, pesan: string): HasilPeriksaUsulan => ({ ok: false, isian, pesan });

  if (typeof d.nama !== 'string' || !d.nama.trim() || d.nama.length > 200) return tolak('nama', PESAN_USULAN.namaKosong);
  const nama = rapikanNama(d.nama);

  const jenisMentah = d.jenis === undefined || d.jenis === null || d.jenis === '' ? null : d.jenis;
  if (jenisMentah !== null && !isJenisUsulan(jenisMentah)) return tolak('jenis', PESAN_USULAN.jenisAsing);

  const judulMentah = typeof d.judul === 'string' ? d.judul : '';
  if (judulMentah.length > MAKS_JUDUL_USULAN * KALI_MENTAH) return tolak('judul', PESAN_USULAN.judulPanjang);
  const judul = teks(judulMentah, MAKS_JUDUL_USULAN, false) ?? '';
  const panjangJudul = jumlahHuruf(judul);
  if (panjangJudul < MIN_JUDUL_USULAN) return tolak('judul', PESAN_USULAN.judulPendek);
  if (panjangJudul > MAKS_JUDUL_USULAN) return tolak('judul', PESAN_USULAN.judulPanjang);

  const isiMentah = typeof d.isi === 'string' ? d.isi : '';
  if (isiMentah.length > MAKS_ISI_USULAN * KALI_MENTAH) return tolak('isi', PESAN_USULAN.isiPanjang);
  const isi = teks(isiMentah, MAKS_ISI_USULAN, true) ?? '';
  const panjangIsi = jumlahHuruf(isi);
  if (panjangIsi < MIN_ISI_USULAN) return tolak('isi', PESAN_USULAN.isiPendek);
  if (panjangIsi > MAKS_ISI_USULAN) return tolak('isi', PESAN_USULAN.isiPanjang);

  return { ok: true, usulan: { nama, judul, isi, jenis: jenisMentah } };
}
