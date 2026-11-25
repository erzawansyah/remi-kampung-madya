// "Yang baru" sesudah pembaruan (permintaan pemilik, 0.8.0): sekali per versi, di beranda, pemain
// yang baru dapat versi baru diberi tahu apa saja yang berubah. Bagian ini murni (tanpa DOM, tanpa
// CHANGELOG): membandingkan versi dan memutuskan perlu tidaknya jendela. Isinya ada di ui/yangBaru.ts
// (dimuat malas bersama Tentang), rangkaiannya di main.ts (`cekYangBaru`).

/** Versi SemVer polos "x.y.z" yang dipakai aplikasi ini; selain itu dianggap rusak. */
const POLA_VERSI = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/;

/** Versi tersimpan yang bisa dipakai, atau null (kosong, rusak, disunting tangan). */
export function rapikanVersi(x: unknown): string | null {
  return typeof x === 'string' && POLA_VERSI.test(x) ? x : null;
}

/** <0 kalau a lebih lama dari b, 0 kalau sama, >0 kalau lebih baru. Keduanya wajib versi rapi. */
export function bandingVersi(a: string, b: string): number {
  const pa = POLA_VERSI.exec(a)!;
  const pb = POLA_VERSI.exec(b)!;
  for (let i = 1; i <= 3; i++) {
    const beda = Number(pa[i]) - Number(pb[i]);
    if (beda) return beda;
  }
  return 0;
}

export type KeputusanYangBaru =
  /** Tidak ada yang perlu dilakukan (sudah melihat versi ini, atau versi tersimpan lebih baru). */
  | { jenis: 'tidak' }
  /** Simpan versi sekarang tanpa jendela (pemain baru). */
  | { jenis: 'diam' }
  /**
   * Tampilkan perubahan sesudah `dari` (eksklusif) sampai versi sekarang. `dari` null = versi sebelumnya
   * tidak diketahui (pemain lama dari sebelum fitur ini ada): cukup perubahan versi sekarang.
   */
  | { jenis: 'tampil'; dari: string | null };

/**
 * Putuskan "Yang baru" saat beranda tampil. `tersimpan` = versi terakhir yang dilihat (sudah dirapikan;
 * rusak = null). `pemainBaru` = beranda sedang menawarkan latihan ("Warga baru, ya?"): jendela tidak
 * pernah menimpa tawaran itu, versinya disimpan diam-diam.
 */
export function putuskanYangBaru(tersimpan: string | null, kini: string, pemainBaru: boolean): KeputusanYangBaru {
  const versiKini = rapikanVersi(kini);
  if (!versiKini) return { jenis: 'tidak' };
  if (tersimpan && bandingVersi(tersimpan, versiKini) >= 0) return { jenis: 'tidak' };
  if (pemainBaru) return { jenis: 'diam' };
  return { jenis: 'tampil', dari: tersimpan };
}
