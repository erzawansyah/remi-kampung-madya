// Pintu masuk jendela yang jarang dibuka (Bantuan, Tentang) lewat import() dinamis: isinya besar
// (aturan lengkap, tanya jawab, CHANGELOG) dan tidak dibutuhkan untuk menggambar beranda, jadi
// dipisah ke chunk sendiri. Chunk-nya tetap ikut precache PWA (globPatterns **/*.js), jadi
// offline pun bisa dibuka. Modul diambil lebih dulu saat browser senggang supaya klik pertama cepat.

import { toast } from './dom';

type ModulBantuan = typeof import('./bantuan');
type ModulTentang = typeof import('./tentang');

let bantuan: Promise<ModulBantuan> | null = null;
let tentang: Promise<ModulTentang> | null = null;

const PESAN_GAGAL = 'Halamannya gagal dimuat, Bos. Cek sinyal lalu coba lagi.';

/** Ambil modulnya; kalau gagal (mis. jaringan putus sebelum precache siap), boleh dicoba lagi nanti. */
function muat<T>(ambil: () => Promise<T>, simpan: (p: Promise<T> | null) => void): Promise<T> {
  const p = ambil();
  simpan(p);
  p.catch(() => simpan(null));
  return p;
}

const muatBantuan = () => bantuan ?? muat(() => import('./bantuan'), (p) => (bantuan = p));
const muatTentang = () => tentang ?? muat(() => import('./tentang'), (p) => (tentang = p));

export function bukaBantuan(bab?: string): void {
  muatBantuan().then(
    (m) => m.bukaBantuan(bab),
    () => toast(PESAN_GAGAL, true),
  );
}

export function bukaTentang(): void {
  muatTentang().then(
    (m) => m.bukaTentang(),
    () => toast(PESAN_GAGAL, true),
  );
}

/** Ambil modul Bantuan & Tentang di latar (saat browser senggang), tanpa membuka apa pun. */
export function siapkanJendelaMalas(): void {
  const jalankan = () => {
    void muatBantuan().catch(() => undefined);
    void muatTentang().catch(() => undefined);
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(jalankan, { timeout: 5000 });
  else setTimeout(jalankan, 2000);
}
