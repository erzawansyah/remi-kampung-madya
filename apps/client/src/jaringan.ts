// Bantuan kecil saat potongan aplikasi (chunk JS dari import() dinamis) gagal dimuat.
//
// Chrome mengingat import() yang gagal per URL: memanggil import() lagi ke URL yang sama langsung ditolak
// tanpa request baru, walau sinyal sudah pulih. Jadi "coba lagi" yang jujur butuh salah satu dari:
// URL yang sedikit beda (query ?ulang=n, dibaca dari pesan galatnya), atau muat ulang halaman.

/** Batas tunggu cek sinyal; lebih dari ini dianggap belum nyambung. */
const BATAS_CEK_MS = 6000;

/**
 * Cek apakah server aplikasi bisa dijangkau sekarang (request HEAD kecil ke halaman ini, tanpa cache).
 * Dipakai sebelum memuat ulang halaman: muat ulang saat sinyal masih putus (dan aplikasi belum tersimpan
 * di HP) malah menampilkan halaman galat browser.
 */
export async function adaJaringan(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const batal = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => batal?.abort(), BATAS_CEK_MS);
  try {
    // Jawaban apa pun (termasuk 404/405) berarti server terjangkau; yang dicari hanya galat jaringan.
    await fetch(location.pathname, { method: 'HEAD', cache: 'no-store', signal: batal?.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * URL chunk JS yang gagal, dibaca dari pesan galat import() dinamis, mis. Chrome:
 * "Failed to fetch dynamically imported module: https://…/assets/bantuan-Ab12.js", Firefox:
 * "error loading dynamically imported module: https://…". Hanya URL seasal (origin sama) yang diterima.
 */
export function urlChunkGagal(galat: unknown): string | null {
  const pesan = galat instanceof Error ? galat.message : String(galat ?? '');
  const m = /(https?:\/\/[^\s'"<>]+?\.(?:m?js|ts))(?:[?#][^\s'"<>]*)?(?=$|[\s'"<>])/.exec(pesan);
  if (!m) return null;
  try {
    const url = new URL(m[1]!);
    return url.origin === location.origin ? url.origin + url.pathname : null;
  } catch {
    return null;
  }
}

let nomorUlang = 0;

/** URL chunk dengan query unik, supaya import() berikutnya benar-benar meminta ulang ke jaringan. */
export function urlUlang(url: string): string {
  return `${url}?ulang=${Date.now().toString(36)}${++nomorUlang}`;
}
