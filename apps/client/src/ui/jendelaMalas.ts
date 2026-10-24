// Pintu masuk jendela yang jarang dibuka (Bantuan, Tentang) lewat import() dinamis: isinya besar
// (aturan lengkap, tanya jawab, CHANGELOG) dan tidak dibutuhkan untuk menggambar beranda, jadi
// dipisah ke chunk sendiri. Chunk-nya tetap ikut precache PWA (globPatterns **/*.js), jadi
// offline pun bisa dibuka. Modul diambil lebih dulu saat browser senggang supaya klik pertama cepat.
//
// Kalau pengambilan gagal (sinyal putus sebelum precache siap), promise yang ditolak tidak disimpan,
// dan percobaan berikutnya memakai URL chunk dengan query unik: Chrome mengingat import() yang gagal
// per URL, jadi import ke URL yang sama tidak akan pernah berhasil lagi tanpa muat ulang halaman.

import { adaJaringan, urlChunkGagal, urlUlang } from '../jaringan';
import { toast } from './dom';
import type { OpsiTentang } from './tentang';

type ModulBantuan = typeof import('./bantuan');
type ModulTentang = typeof import('./tentang');

export const PESAN_GAGAL = 'Halamannya gagal dimuat, Bos. Cek sinyal lalu coba lagi.';
export const PESAN_MASIH_GAGAL = 'Halamannya masih gagal dimuat, Bos. Muat ulang aplikasinya ya.';

export interface PemuatMalas<T> {
  /** Ambil modulnya; promise yang gagal dibuang supaya bisa dicoba lagi (dengan URL baru). */
  muat(): Promise<T>;
  /** Percobaan gagal berturut-turut sejak terakhir berhasil. */
  readonly gagal: number;
  /** Lupakan semuanya (khusus test). */
  setelUlang(): void;
}

/**
 * Pemuat modul malas yang bisa dicoba lagi. `ambil` = import() statis (dianalisis Vite, ikut precache);
 * sesudah gagal, percobaan berikutnya memakai `imporUrl` ke URL chunk yang gagal + query unik.
 */
export function pemuatMalas<T>(
  ambil: () => Promise<T>,
  imporUrl: (url: string) => Promise<unknown> = (url) => import(/* @vite-ignore */ url),
): PemuatMalas<T> {
  let janji: Promise<T> | null = null;
  let urlGagal: string | null = null;
  let gagal = 0;
  return {
    get gagal() {
      return gagal;
    },
    muat() {
      if (janji) return janji;
      const url = urlGagal;
      const p = url ? (imporUrl(urlUlang(url)) as Promise<T>) : ambil();
      janji = p;
      p.then(
        () => {
          gagal = 0;
          urlGagal = null;
        },
        (e: unknown) => {
          if (janji === p) janji = null;
          gagal++;
          // URL asli yang gagal tetap dipakai; urlUlang() selalu memberi query baru.
          urlGagal = urlChunkGagal(e) ?? url;
        },
      );
      return p;
    },
    setelUlang() {
      janji = null;
      urlGagal = null;
      gagal = 0;
    },
  };
}

const bantuan = pemuatMalas<ModulBantuan>(() => import('./bantuan'));
const tentang = pemuatMalas<ModulTentang>(() => import('./tentang'));

/** Berapa kali pemain membuka jendela dan gagal, berturut-turut. */
const gagalDibuka = new WeakMap<PemuatMalas<unknown>, number>();

/**
 * Buka jendela dari modul malas. Gagal: tawarkan "Coba lagi". Dibuka lagi dan gagal lagi padahal sinyal
 * ada (mis. bagian lain chunk-nya ikut gagal dan diingat browser): tawarkan muat ulang aplikasi.
 */

export function bukaMalas<T>(m: PemuatMalas<T>, jalankan: (modul: T) => void, ulangi: () => void): Promise<void> {
  const ok = (modul: T) => {
    gagalDibuka.delete(m);
    jalankan(modul);
  };
  return m.muat().then(ok, async () => {
    // Yang dihitung hanya kegagalan yang dilihat pemain (pramuat diam-diam di latar tidak ikut).
    const kali = (gagalDibuka.get(m) ?? 0) + 1;
    gagalDibuka.set(m, kali);
    if (kali >= 2 && (await adaJaringan())) {
      toast(PESAN_MASIH_GAGAL, true, 9000, { label: 'Muat ulang', jalankan: () => location.reload() });
      return;
    }
    toast(PESAN_GAGAL, true, 9000, { label: 'Coba lagi', jalankan: ulangi });
  });
}

export function bukaBantuan(bab?: string): void {
  void bukaMalas(bantuan, (m) => m.bukaBantuan(bab), () => bukaBantuan(bab));
}

export function bukaTentang(opsi: OpsiTentang = {}): void {
  void bukaMalas(tentang, (m) => m.bukaTentang(opsi), () => bukaTentang(opsi));
}

/** Ambil modul Bantuan & Tentang di latar (saat browser senggang), tanpa membuka apa pun. */
export function siapkanJendelaMalas(): void {
  const jalankan = () => {
    // Sinyal jelas putus: jangan memancing kegagalan di belakang layar, ambil saat dibuka saja.
    if (navigator.onLine === false) return;
    void bantuan.muat().catch(() => undefined);
    void tentang.muat().catch(() => undefined);
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(jalankan, { timeout: 5000 });
  else setTimeout(jalankan, 2000);
}

/** Khusus test: kosongkan keadaan pemuat. */
export function _setelUlangJendelaMalas(): void {
  bantuan.setelUlang();
  tentang.setelUlang();
}
