// Nama pemain (keputusan pemilik #49): wajib diisi sebelum main, dan sesudah diganti baru bisa
// diganti lagi seminggu kemudian. Dikunci di HP saja (remi.nama + remi.namaDiganti), belum ada
// akun di server. Isi nama pertama kali tidak memasang jeda, dan pemain lama yang namanya sudah
// tersimpan sebelum aturan ini boleh mengganti sekali tanpa menunggu.

/** Jeda antar ganti nama: 7 hari. */
export const JEDA_GANTI_NAMA_MS = 7 * 24 * 60 * 60 * 1000;

export interface KeadaanNama {
  /** Nama yang tersimpan, '' kalau belum diisi. */
  nama: string;
  /** Kapan terakhir diganti (ms). Kosong = belum pernah diganti (atau isi pertama). */
  diganti: number | null;
}

/** Waktu (ms) nama boleh diganti lagi, atau null kalau sekarang sudah boleh. */
export function namaTerkunciSampai(k: KeadaanNama, sekarang: number): number | null {
  if (!k.nama || k.diganti === null) return null;
  const sampai = k.diganti + JEDA_GANTI_NAMA_MS;
  // Jam HP mundur jauh ke belakang (diganti "di masa depan"): jangan dikunci selamanya.
  if (k.diganti > sekarang + JEDA_GANTI_NAMA_MS) return null;
  return sampai > sekarang ? sampai : null;
}

/** Hasil mengisi nama baru: isi pertama tanpa jeda, ganti nama memasang jeda. */
export function simpanNamaBaru(lama: KeadaanNama, baru: string, sekarang: number): KeadaanNama {
  if (!lama.nama) return { nama: baru, diganti: null };
  if (baru === lama.nama) return lama;
  return { nama: baru, diganti: sekarang };
}

/** "Sabtu, 25 Okt" (tanggal nama bisa diganti lagi). */
export function labelTanggalGanti(ms: number): string {
  return new Date(ms).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
}
